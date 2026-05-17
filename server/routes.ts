import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { getDB, saveDB } from './db.ts';
import { getAdminSpotifyToken, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, REDIRECT_URI } from './spotify.ts';
import { Server as SocketServer } from 'socket.io';

export function setupRoutes(app: express.Express, io: SocketServer) {
    
    function hasAdminAccess(req: express.Request, db: any) {
        const userId = req.cookies.user_id;
        const adminAuth = req.cookies.admin_authenticated;
        if (adminAuth === 'true') return true;
        if (!userId) return false;
        return db.moderators && db.moderators.includes(userId);
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions: any = { 
        httpOnly: true, 
        secure: isProduction, 
        sameSite: isProduction ? 'none' : 'lax', 
        maxAge: 3600000 
    };

    // Auth
    app.post('/api/admin/verify-pin', (req, res) => {
        const { pin } = req.body;
        const correctPin = process.env.ADMIN_PASSWORD || '123';
        if (pin === correctPin) {
            res.cookie('admin_authenticated', 'true', cookieOptions);
            return res.json({ success: true });
        }
        res.status(401).json({ error: 'Falscher PIN' });
    });

    app.post('/api/auth/login', (req, res) => {
        const { username, department } = req.body;
        if (!username || !department) return res.status(400).json({ error: 'Username and department are required' });
        const db = getDB();
        let userId = Object.keys(db.users).find(id => 
            db.users[id].username.toLowerCase() === username.toLowerCase() && 
            db.users[id].department.toLowerCase() === department.toLowerCase()
        );
        if (!userId) {
            userId = uuidv4();
            db.users[userId] = { username, department };
            saveDB(db);
        }
        res.cookie('user_id', userId, cookieOptions);
        res.json({ userId, username, department });
    });

    app.post('/api/auth/sync', (req, res) => {
        const { userId, username, department } = req.body;
        if (!userId || !username || !department) return res.sendStatus(400);
        const db = getDB();
        db.users[userId] = { username, department };
        saveDB(db);
        res.json({ success: true });
    });

    // Spotify OAuth
    app.get('/api/spotify/status', (req, res) => {
        const db = getDB();
        res.json({ connected: !!db.adminToken });
    });

    app.get('/api/auth/spotify/url', (req, res) => {
        if (!SPOTIFY_CLIENT_ID) return res.status(500).json({ error: 'Spotify Client ID not configured' });
        const scopes = 'user-modify-playback-state user-read-playback-state';
        const spotifyUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
            response_type: 'code',
            client_id: SPOTIFY_CLIENT_ID,
            scope: scopes,
            redirect_uri: REDIRECT_URI,
        }).toString()}`;
        res.json({ url: spotifyUrl });
    });

    app.post('/api/auth/spotify/logout', (req, res) => {
        const db = getDB();
        db.adminToken = null;
        saveDB(db);
        res.clearCookie('spotify_token');
        res.json({ success: true });
    });

    app.get(['/auth/callback', '/auth/callback/', '/api/spotify/callback'], async (req, res) => {
        const { code } = req.query;
        if (!code) return res.redirect('/');
        try {
            const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
                grant_type: 'authorization_code',
                code: code as string,
                redirect_uri: REDIRECT_URI,
                client_id: SPOTIFY_CLIENT_ID || '',
                client_secret: SPOTIFY_CLIENT_SECRET || '',
            }), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            const { access_token, refresh_token, expires_in } = response.data;
            const db = getDB();
            db.adminToken = {
                accessToken: access_token,
                refreshToken: refresh_token,
                expiresAt: Date.now() + (expires_in * 1000) - 60000
            };
            saveDB(db);
            res.cookie('spotify_token', access_token, cookieOptions);
            res.send('<html><body><script>window.opener.postMessage({ type: "OAUTH_AUTH_SUCCESS" }, "*");window.close();</script></body></html>');
        } catch (error: any) {
            res.status(500).send('Spotify connection failed.');
        }
    });

    // Songs API
    app.get('/api/songs', (req, res) => {
        const db = getDB();
        const songsWithVoters = (db.songs || []).map((song: any) => ({
            ...song,
            voters: {
                up: (song.upvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' }),
                down: (song.downvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' })
            }
        }));
        res.json({ songs: songsWithVoters.sort((a, b) => b.votes - a.votes), settings: db.settings });
    });

    app.post('/api/songs', (req, res) => {
        const { title, artist, albumArt, spotifyUri, requestedBy } = req.body;
        const userId = req.cookies.user_id;
        if (!title || !artist) return res.status(400).json({ error: 'Title and artist required' });
        const db = getDB();
        const newSong = {
            id: uuidv4(),
            title, artist, albumArt, spotifyUri, requestedBy,
            votes: userId ? 1 : 0,
            upvoters: userId ? [userId] : [],
            downvoters: [],
            status: 'requested',
            createdAt: new Date().toISOString()
        };
        db.songs.push(newSong);
        saveDB(db);
        io.emit('songs:updated');
        res.json(newSong);
    });

    app.post('/api/songs/:id/vote', (req, res) => {
        const { id } = req.params;
        const { type } = req.body;
        const userId = req.cookies.user_id || req.body.userId;
        if (!userId) return res.status(401).json({ error: 'Not authenticated' });
        const db = getDB();
        const song = db.songs.find((s: any) => s.id === id);
        if (!song) return res.status(404).json({ error: 'Song not found' });
        
        if (!song.upvoters) song.upvoters = [];
        if (!song.downvoters) song.downvoters = [];

        if (type === 'up') {
            if (song.upvoters.includes(userId)) song.upvoters = song.upvoters.filter((vId: string) => vId !== userId);
            else { song.upvoters.push(userId); song.downvoters = song.downvoters.filter((vId: string) => vId !== userId); }
        } else if (type === 'down' && db.settings.downvotesEnabled) {
            if (song.downvoters.includes(userId)) song.downvoters = song.downvoters.filter((vId: string) => vId !== userId);
            else { song.downvoters.push(userId); song.upvoters = song.upvoters.filter((vId: string) => vId !== userId); }
        }

        song.votes = song.upvoters.length - song.downvoters.length;
        saveDB(db);
        io.emit('songs:updated');
        res.json(song);
    });

    app.post('/api/songs/:id/queue', async (req, res) => {
        const { id } = req.params;
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Unauthorized' });
        const song = db.songs.find((s: any) => s.id === id);
        if (!song) return res.status(400).json({ error: 'Song not found' });
        song.status = 'priority';
        saveDB(db);
        io.emit('songs:updated');
        res.json({ success: true });
    });

    app.delete('/api/songs/:id', (req, res) => {
        const { id } = req.params;
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Unauthorized' });
        db.songs = db.songs.filter((s: any) => s.id !== id);
        saveDB(db);
        io.emit('songs:updated');
        res.json({ success: true });
    });

    // Admin APIs
    app.get('/api/departments', (req, res) => res.json(getDB().departments));
    app.post('/api/admin/departments', (req, res) => {
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Unauthorized' });
        db.departments = req.body.departments;
        saveDB(db);
        io.emit('songs:updated');
        res.json(db.departments);
    });

    app.get('/api/admin/users', (req, res) => {
        const db = getDB();
        res.json(Object.entries(db.users).map(([id, data]: [string, any]) => ({ id, ...data, isModerator: db.moderators.includes(id) })));
    });

    app.post('/api/admin/users/:id/moderator', (req, res) => {
        const { id } = req.params;
        const { enabled } = req.body;
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Unauthorized' });
        if (enabled) { if (!db.moderators.includes(id)) db.moderators.push(id); }
        else { db.moderators = db.moderators.filter((mId: string) => mId !== id); }
        saveDB(db);
        io.emit('songs:updated');
        res.json({ success: true });
    });

    app.get('/api/admin/settings', (req, res) => res.json(getDB().settings));
    app.post('/api/admin/settings', (req, res) => {
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Unauthorized' });
        if (req.body.downvotesEnabled !== undefined) db.settings.downvotesEnabled = !!req.body.downvotesEnabled;
        if (req.body.autoplayEnabled !== undefined) db.settings.autoplayEnabled = !!req.body.autoplayEnabled;
        saveDB(db);
        io.emit('songs:updated');
        res.json(db.settings);
    });

    app.get('/api/spotify/search', async (req, res) => {
        const token = await getAdminSpotifyToken();
        if (!token) return res.status(401).json({ 
            error: 'Spotify nicht verbunden', 
            details: 'Der Admin-Account wurde noch nicht mit Spotify verknüpft.' 
        });

        try {
            const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(req.query.q as string)}&type=track&limit=5`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            res.json(response.data.tracks.items);
        } catch (error: any) {
            const errorData = error.response?.data || error.message;
            console.error('Spotify Search: FAILED', errorData);
            
            let extraHint = '';
            if (error.response?.status === 403) {
                extraHint = ' (Hinweis: Falls die App im Spotify Developer Mode ist, muss der Account unter "Users and Access" hinzugefügt werden.)';
            } else if (error.response?.status === 401) {
                extraHint = ' (Hinweis: Der Token scheint ungültig zu sein. Bitte in den Admin-Einstellungen Spotify neu verbinden.)';
            }

            res.status(500).json({ 
                error: 'Spotify Suche fehlgeschlagen', 
                details: (error.response?.data?.error?.message || error.message) + extraHint,
                rawError: errorData
            });
        }
    });

    app.get('/api/player/current', async (req, res) => {
        const token = await getAdminSpotifyToken();
        if (!token) return res.json({ playback: null });
        try {
            const response = await axios.get('https://api.spotify.com/v1/me/player', { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.data || !response.data.item) return res.json({ playback: null });
            const playback = response.data;
            const db = getDB();
            let voterInfo = db.history[playback.item.uri] || db.songs.find((s: any) => s.spotifyUri === playback.item.uri);
            res.json({
                playback: {
                    item: {
                        name: playback.item.name,
                        artists: playback.item.artists.map((a: any) => a.name),
                        albumArt: playback.item.album.images[0]?.url,
                        duration_ms: playback.item.duration_ms,
                        uri: playback.item.uri
                    },
                    progress_ms: playback.progress_ms,
                    is_playing: playback.is_playing,
                    voterInfo: voterInfo ? { 
                        ...voterInfo, 
                        voters: {
                            up: (voterInfo.upvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' }),
                            down: (voterInfo.downvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' })
                        }
                    } : null
                }
            });
        } catch { res.json({ playback: null }); }
    });
    
    app.get('/api/admin/stats', (req, res) => {
        const db = getDB();
        const mapVoters = (voters: string[]) => voters.map(vId => db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' });
        const processSong = (song: any) => ({
            ...song,
            totalVotes: song.votes,
            upvotes: (song.upvoters || []).length,
            downvotes: (song.downvoters || []).length,
            departmentsUp: mapVoters(song.upvoters || []).reduce((acc: any, v: any) => { (acc[v.department] = acc[v.department] || []).push(v.username); return acc; }, {}),
            departmentsDown: mapVoters(song.downvoters || []).reduce((acc: any, v: any) => { (acc[v.department] = acc[v.department] || []).push(v.username); return acc; }, {})
        });
        res.json({
            current: db.songs.map(processSong),
            history: Object.entries(db.history).map(([uri, data]: [string, any]) => processSong({ ...data, id: uri, spotifyUri: uri }))
        });
    });

    app.get('/api/admin/debug-spotify', (req, res) => {
        const db = getDB();
        if (!hasAdminAccess(req, db)) return res.status(403).json({ error: 'Nicht autorisiert.' });

        res.json({
            hasClientId: !!SPOTIFY_CLIENT_ID,
            hasClientSecret: !!SPOTIFY_CLIENT_SECRET,
            hasAppUrl: !!process.env.APP_URL,
            redirectUri: REDIRECT_URI,
            hasAdminToken: !!db.adminToken,
            hasRefreshToken: !!db.adminToken?.refreshToken,
            tokenExpiresAt: db.adminToken?.expiresAt ? new Date(db.adminToken.expiresAt).toISOString() : 'N/A',
            isTokenExpired: db.adminToken?.expiresAt ? Date.now() > db.adminToken.expiresAt : false,
            env: {
                SPOTIFY_CLIENT_ID: SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 4)}...` : 'FEHLT',
                SPOTIFY_CLIENT_SECRET: SPOTIFY_CLIENT_SECRET ? 'VORHANDEN' : 'FEHLT',
                APP_URL: process.env.APP_URL || 'FEHLT'
            }
        });
    });
}

import express from 'express';
import { createServer as createViteServer } from 'vite';
import { createServer as createHttpServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createHttpServer(app);
const io = new SocketServer(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Simple local database
const DB_PATH = path.join(__dirname, 'db.json');
    if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ 
        songs: [], 
        users: {}, 
        adminToken: null,
        settings: { downvotesEnabled: false, autoplayEnabled: false },
        history: {}, // Map URI to voters info
        departments: ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'],
        moderators: [] // Array of user IDs
    }));
}

function getDB() {
    try {
        const data = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
        if (!data.adminToken) data.adminToken = null;
        if (!data.songs) data.songs = [];
        if (!data.users) data.users = {};
        if (!data.settings) data.settings = { downvotesEnabled: false, autoplayEnabled: false };
        if (!data.history) data.history = {};
        if (!data.departments) data.departments = ['Entwicklung', 'Marketing', 'Vertrieb', 'Design', 'HR', 'Support'];
        if (!data.moderators) data.moderators = [];
        return data;
    } catch (error) {
        console.error('Failed to read or parse database:', error);
        return { songs: [], users: {}, adminToken: null, settings: { downvotesEnabled: false, autoplayEnabled: false }, history: {}, moderators: [] };
    }
}

function saveDB(data: any) {
    try {
        fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Failed to save database:', error);
    }
}

// Global state for management
let lastAutopliedUri: string | null = null;
let isQueueing = false; // Lock for queueing operations

async function checkAutoplay() {
    if (isQueueing) return; // Don't run while a manual or previous autoplay queue action is in progress

    const db = getDB();
    if (!db.adminToken) return;

    try {
        const spotifyToken = await getAdminSpotifyToken();
        const response = await axios.get('https://api.spotify.com/v1/me/player', {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });

        const playback = response.data;
        
        // Fetch current queue to check status
        const queueResponse = await axios.get('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
        const currentQueue = queueResponse.data?.queue || [];
        
        // --- CLEANUP SECTION (Runs always if token exists) ---
        let dbChanged = false;
        db.songs.forEach((s: any) => {
            if (s.status === 'queued') {
                const isCurrentlyPlaying = playback?.item?.uri === s.spotifyUri;
                const isStillInQueue = currentQueue.some((item: any) => item.uri === s.spotifyUri);
                
                // If it's playing or no longer in queue (meaning played/skipped), mark as processed
                if (isCurrentlyPlaying || !isStillInQueue) {
                    db.history[s.spotifyUri] = {
                        title: s.title,
                        artist: s.artist,
                        upvoters: s.upvoters || [],
                        downvoters: s.downvoters || [],
                        votes: s.votes || 0,
                        requestedBy: s.requestedBy
                    };
                    s._shouldRemove = true;
                    dbChanged = true;
                }
            }
        });

        if (dbChanged) {
            db.songs = db.songs.filter((s: any) => !s._shouldRemove);
            saveDB(db);
            io.emit('songs:updated');
        }

        // --- BROADCAST PLAYBACK ---
        if (playback && playback.item) {
            const uri = playback.item.uri;
            let voterInfo = db.history[uri];
            if (!voterInfo) {
                const currentSong = db.songs.find((s: any) => s.spotifyUri === uri);
                if (currentSong) {
                    voterInfo = {
                        upvoters: currentSong.upvoters || [],
                        downvoters: currentSong.downvoters || [],
                        votes: currentSong.votes || 0,
                        requestedBy: currentSong.requestedBy
                    };
                }
            }

            const voters = {
                up: (voterInfo?.upvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' }),
                down: (voterInfo?.downvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' })
            };

            io.emit('playback:updated', {
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
                    voterInfo: voterInfo ? { ...voterInfo, voters } : null
                }
            });
        } else {
            io.emit('playback:updated', { playback: null });
        }

        // --- AUTOPLAY SECTION ---
        if (!db.settings.autoplayEnabled) return;

        // Prevent autoplay if we already have songs in the queue
        const currentlyQueuedSentCount = db.songs.filter((s: any) => s.status === 'queued').length;
        if (currentlyQueuedSentCount > 0) {
            // Check if we should mark the queued song as played if it finished but playback doesn't tell us
            return;
        }

        // Find candidate songs (priority first, then by votes)
        const candidates = db.songs.filter((s: any) => s.status !== 'queued' && s.status !== 'played');
        if (candidates.length === 0) return;

        const topSong = candidates.sort((a, b) => {
            if (a.status === 'priority' && b.status !== 'priority') return -1;
            if (a.status !== 'priority' && b.status === 'priority') return 1;
            return b.votes - a.votes;
        })[0];

        if (!topSong) return;

        // Check if our top song is already in the next few slots of the Spotify queue
        const isAlreadyInQueue = currentQueue.slice(0, 5).some((item: any) => item.uri === topSong.spotifyUri);

        let shouldQueue = false;
        if (!playback || !playback.item) {
            // No playback active, queue if not already there
            if (!isAlreadyInQueue) {
                shouldQueue = true;
            }
        } else {
            const timeLeft = playback.item.duration_ms - playback.progress_ms;
            // If less than 20 seconds left, and it's not already in queue, and it's not the currently playing song
            if (timeLeft < 20000 && !isAlreadyInQueue && playback.item.uri !== topSong.spotifyUri) {
                shouldQueue = true;
            }
        }

        if (shouldQueue) {
            isQueueing = true;
            try {
                console.log(`Autoplay: Queueing top song "${topSong.title}"`);
                await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(topSong.spotifyUri)}`, {}, {
                    headers: { 'Authorization': `Bearer ${spotifyToken}` }
                });
                
                lastAutopliedUri = topSong.spotifyUri;
                
                // Mark as queued instead of removing
                topSong.status = 'queued';
                saveDB(db);
                io.emit('songs:updated');
            } finally {
                isQueueing = false;
            }
        }
    } catch (error: any) {
        // Silently fail
    }
}

// Poll for sync/autoplay every 6 seconds
setInterval(checkAutoplay, 6000);

// Spotify config
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    console.warn('WARNING: Spotify credentials are not fully configured in environment variables.');
}

async function refreshAdminToken(db: any) {
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        console.error('Spotify token refresh FAILED: Client ID or Secret missing in environment variables.');
        return null;
    }
    
    console.log('Spotify: Refreshing admin token...');
    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: db.adminToken.refreshToken,
            client_id: SPOTIFY_CLIENT_ID,
            client_secret: SPOTIFY_CLIENT_SECRET,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, expires_in, refresh_token: new_refresh_token } = response.data;
        db.adminToken.accessToken = access_token;
        db.adminToken.expiresAt = Date.now() + (expires_in * 1000) - 60000;
        if (new_refresh_token) db.adminToken.refreshToken = new_refresh_token;
        saveDB(db);
        console.log('Spotify: Token successfully refreshed.');
        return access_token;
    } catch (error: any) {
        console.error('Spotify: ERROR refreshing token:', error.response?.data || error.message);
        return null;
    }
}

async function getAdminSpotifyToken() {
    const db = getDB();
    if (!db.adminToken) {
        console.warn('Spotify: Request for admin token but no token stored in DB.');
        return null;
    }

    if (Date.now() > db.adminToken.expiresAt) {
        return await refreshAdminToken(db);
    }

    return db.adminToken.accessToken;
}

// --- MODERATOR & PERMISSION HELPERS ---
function hasAdminAccess(req: express.Request, db: any) {
    const userId = req.cookies.user_id;
    const adminAuth = req.cookies.admin_authenticated;
    
    // Check PIN authentication
    if (adminAuth === 'true') return true;

    if (!userId) return false;
    // Hardcoded master admin check
    const user = db.users[userId];
    if (user && user.username.toLowerCase() === 'admin' && user.department.toLowerCase() === 'dev') return true;
    
    return db.moderators && db.moderators.includes(userId);
}

// --- PIN VERIFICATION ---
app.post('/api/admin/verify-pin', (req, res) => {
    const { pin } = req.body;
    if (pin === '123') {
        res.cookie('admin_authenticated', 'true', { httpOnly: true, secure: true, sameSite: 'none', maxAge: 3600000 }); // 1 hour
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Falscher PIN' });
});

// --- DEPARTMENT ROUTES ---

app.get('/api/departments', (req, res) => {
    const db = getDB();
    res.json(db.departments || []);
});

app.post('/api/admin/departments', (req, res) => {
    const { departments } = req.body;
    const db = getDB();

    if (!hasAdminAccess(req, db)) {
        return res.status(403).json({ error: 'Nicht autorisiert.' });
    }

    if (Array.isArray(departments)) {
        db.departments = departments;
        saveDB(db);
        io.emit('songs:updated');
        res.json(db.departments);
    } else {
        res.status(400).json({ error: 'Invalid departments format' });
    }
});

// --- ADMIN USER MANAGEMENT ---

app.get('/api/admin/users', (req, res) => {
    const db = getDB();
    const userList = Object.entries(db.users).map(([id, data]: [string, any]) => ({
        id,
        ...data,
        isModerator: db.moderators.includes(id)
    }));
    res.json(userList);
});

app.post('/api/admin/users/:id/moderator', (req, res) => {
    const { id } = req.params;
    const { enabled } = req.body;
    const db = getDB();

    if (!hasAdminAccess(req, db)) {
        return res.status(403).json({ error: 'Nicht autorisiert.' });
    }

    if (enabled) {
        if (!db.moderators.includes(id)) db.moderators.push(id);
    } else {
        db.moderators = db.moderators.filter((mId: string) => mId !== id);
    }

    saveDB(db);
    io.emit('songs:updated');
    res.json({ success: true, isModerator: enabled });
});

// --- AUTH ROUTES ---

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.post('/api/auth/login', (req, res) => {
    const { username, department } = req.body;
    if (!username || !department) {
        return res.status(400).json({ error: 'Username and department are required' });
    }
    
    const db = getDB();
    
    // Check if user already exists (by name and department)
    let userId = Object.keys(db.users).find(id => 
        db.users[id].username.toLowerCase() === username.toLowerCase() && 
        db.users[id].department.toLowerCase() === department.toLowerCase()
    );

    if (!userId) {
        userId = uuidv4();
        db.users[userId] = { username, department };
        saveDB(db);
    }

    res.cookie('user_id', userId, { httpOnly: true, secure: true, sameSite: 'none' });
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

// --- SPOTIFY OAUTH ---

app.get('/api/auth/spotify/url', (req, res) => {
    if (!SPOTIFY_CLIENT_ID) {
        return res.status(500).json({ error: 'Spotify Client ID not configured' });
    }
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

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    try {
        console.log(`Spotify Auth: Exchanging code for token using redirect_uri: ${REDIRECT_URI}`);
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
        console.log('Spotify Auth: Token exchange SUCCESS');
        
        // Store as shared Admin token
        const db = getDB();
        db.adminToken = {
            accessToken: access_token,
            refreshToken: refresh_token,
            expiresAt: Date.now() + (expires_in * 1000) - 60000
        };
        saveDB(db);

        res.cookie('spotify_token', access_token, { httpOnly: true, secure: true, sameSite: 'none' });
        
        res.send(`
            <html>
                <body>
                    <script>
                        window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS' }, '*');
                        window.close();
                    </script>
                </body>
            </html>
        `);
    } catch (error: any) {
        const errorData = error.response?.data || error.message;
        console.error('Spotify Auth: Token exchange FAILED', errorData);
        
        let errorMessage = 'Spotify token exchange failed. Check server logs for details.';
        if (error.response?.status === 400 && error.response?.data?.error === 'invalid_grant') {
            errorMessage = 'Spotify Error: "invalid_grant". This often means the Authorization Code was already used or the Redirect URI does not match exactly what is in your Spotify Dashboard (including http/https and trailing slashes).';
        }

        res.status(500).send(`
            <html>
                <body style="font-family: sans-serif; padding: 20px; line-height: 1.5;">
                    <h1 style="color: #ef4444;">Spotify Verbindung fehlgeschlagen</h1>
                    <p>${errorMessage}</p>
                    <p style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
                        ${JSON.stringify(errorData)}
                    </p>
                    <button onclick="window.close()">Fenster schließen</button>
                    <hr />
                    <h3>Häufige Probleme:</h3>
                    <ul>
                        <li><b>Redirect URI:</b> Muss exakt mit dem Eintrag im Spotify Dashboard übereinstimmen: <br/><code>${REDIRECT_URI}</code></li>
                        <li><b>Developer Mode:</b> Falls deine App noch im "Development" Status ist, musst du Benutzer unter "Users and Access" manuell hinzufügen.</li>
                    </ul>
                </body>
            </html>
        `);
    }
});

app.get('/api/spotify/status', async (req, res) => {
    try {
        const token = await getAdminSpotifyToken();
        res.json({ connected: !!token });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to check Spotify status', details: error.message });
    }
});

app.get('/api/player/current', async (req, res) => {
    try {
        const token = await getAdminSpotifyToken();
        if (!token) return res.json({ playback: null });

        const response = await axios.get('https://api.spotify.com/v1/me/player', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.data || !response.data.item) {
            return res.json({ playback: null });
        }

        const playback = response.data;
        const uri = playback.item.uri;
        const db = getDB();
        
        // Get voter info from history OR current songs (in case it was manually played)
        let voterInfo = db.history[uri];
        if (!voterInfo) {
            const currentSong = db.songs.find((s: any) => s.spotifyUri === uri);
            if (currentSong) {
                voterInfo = {
                    upvoters: currentSong.upvoters || [],
                    downvoters: currentSong.downvoters || [],
                    votes: currentSong.votes || 0,
                    requestedBy: currentSong.requestedBy
                };
            }
        }

        // Map voter user IDs to usernames/departments
        const voters = {
            up: (voterInfo?.upvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' }),
            down: (voterInfo?.downvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' })
        };

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
                voterInfo: voterInfo ? { ...voterInfo, voters } : null
            }
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to get current player state', details: error.message });
    }
});

// --- SONG APP API ---

app.get('/api/songs', (req, res) => {
    try {
        const db = getDB();
        const songsWithVoters = (db.songs || []).map((song: any) => ({
            ...song,
            voters: {
                up: (song.upvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' }),
                down: (song.downvoters || []).map((id: string) => db.users[id] || { username: 'Unbekannt', department: 'Sonstige' })
            }
        }));
        const sortedSongs = songsWithVoters.sort((a, b) => b.votes - a.votes);
        res.json({
            songs: sortedSongs,
            settings: db.settings
        });
    } catch (error: any) {
        res.status(500).json({ error: 'Failed to fetch songs', details: error.message });
    }
});

app.post('/api/songs', (req, res) => {
    const { title, artist, albumArt, spotifyUri, requestedBy } = req.body;
    const userId = req.cookies.user_id;

    if (!title || !artist) return res.status(400).json({ error: 'Title and artist required' });

    const db = getDB();
    const newSong = {
        id: uuidv4(),
        title,
        artist,
        albumArt: albumArt || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
        spotifyUri,
        requestedBy,
        votes: userId ? 1 : 0,
        upvoters: userId ? [userId] : [], // User IDs who upvoted
        downvoters: [], // User IDs who downvoted
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
    const { type } = req.body; // 'up' or 'down'
    const userId = req.cookies.user_id || req.body.userId;
    
    if (!userId) {
        console.error('Vote failed: No userId provided');
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const db = getDB();
    const song = db.songs.find((s: any) => s.id === id);
    if (!song) {
        console.error(`Vote failed: Song ${id} not found`);
        return res.status(404).json({ error: 'Song not found' });
    }

    // Initialize arrays if they don't exist
    if (!song.upvoters) song.upvoters = [];
    if (!song.downvoters) song.downvoters = [];

    const isUpvote = type === 'up';
    const isDownvote = type === 'down';

    if (isUpvote) {
        // Toggle upvote
        if (song.upvoters.includes(userId)) {
            song.upvoters = song.upvoters.filter((vId: string) => vId !== userId);
        } else {
            song.upvoters.push(userId);
            // Remove from downvoters if they were there
            song.downvoters = song.downvoters.filter((vId: string) => vId !== userId);
        }
    } else if (isDownvote && db.settings.downvotesEnabled) {
        // Toggle downvote
        if (song.downvoters.includes(userId)) {
            song.downvoters = song.downvoters.filter((vId: string) => vId !== userId);
        } else {
            song.downvoters.push(userId);
            // Remove from upvoters if they were there
            song.upvoters = song.upvoters.filter((vId: string) => vId !== userId);
        }
    }

    // Recalculate total votes
    song.votes = song.upvoters.length - song.downvoters.length;

    saveDB(db);
    io.emit('songs:updated');
    res.json(song);
});

app.post('/api/songs/:id/queue', async (req, res) => {
    if (isQueueing) return res.status(429).json({ error: 'Warteschlange wird gerade aktualisiert. Bitte kurz warten.' });
    
    const { id } = req.params;
    const currentDb = getDB();

    if (!hasAdminAccess(req, currentDb)) {
        return res.status(403).json({ error: 'Nur Moderatoren dürfen Lieder zur Spotify Queue hinzufügen.' });
    }

    const song = currentDb.songs.find((s: any) => s.id === id);
    if (!song || !song.spotifyUri) {
        return res.status(400).json({ error: 'Song or Spotify URI not found' });
    }

    if (song.status === 'queued' || song.status === 'priority') {
        return res.status(400).json({ error: 'Song ist bereits in der Warteschlange.' });
    }

    // Set to priority instead of pushing to Spotify immediately
    // This allows votes to influence the order until the song is actually pushed by autoplay
    song.status = 'priority';
    saveDB(currentDb);
    
    io.emit('songs:updated');
    res.json({ success: true });
});

app.get('/api/admin/debug-spotify', (req, res) => {
    const db = getDB();
    if (!hasAdminAccess(req, db)) {
        return res.status(403).json({ error: 'Nicht autorisiert.' });
    }

    const config = {
        hasClientId: !!SPOTIFY_CLIENT_ID,
        hasClientSecret: !!SPOTIFY_CLIENT_SECRET,
        hasAppUrl: !!process.env.APP_URL,
        redirectUri: REDIRECT_URI,
        hasAdminToken: !!db.adminToken,
        hasRefreshToken: !!db.adminToken?.refreshToken,
        tokenExpiresAt: db.adminToken?.expiresAt ? new Date(db.adminToken.expiresAt).toISOString() : 'N/A',
        isTokenExpired: db.adminToken?.expiresAt ? Date.now() > db.adminToken.expiresAt : 'N/A',
        env: {
            NODE_ENV: process.env.NODE_ENV,
            // Don't leak actual secrets, just presence
            SPOTIFY_CLIENT_ID: SPOTIFY_CLIENT_ID ? `${SPOTIFY_CLIENT_ID.substring(0, 4)}...` : 'MISSING',
            SPOTIFY_CLIENT_SECRET: SPOTIFY_CLIENT_SECRET ? 'PRESENT' : 'MISSING',
            APP_URL: process.env.APP_URL || 'MISSING'
        }
    };

    res.json(config);
});

app.get('/api/spotify/search', async (req, res) => {
    const { q } = req.query;
    
    // Check configuration first
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
        return res.status(500).json({ 
            error: 'Spotify nicht konfiguriert', 
            details: 'Client ID oder Secret fehlt in den Umgebungsvariablen (Environment Variables).' 
        });
    }

    const token = await getAdminSpotifyToken();
    if (!token) {
        return res.status(401).json({ 
            error: 'Spotify nicht verbunden', 
            details: 'Der Admin-Account wurde noch nicht mit Spotify verknüpft oder die Sitzung ist abgelaufen.' 
        });
    }

    try {
        console.log(`Spotify Search: Querying "${q}"`);
        const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=track&limit=5`, {
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

app.get('/api/admin/settings', (req, res) => {
    const db = getDB();
    res.json(db.settings);
});

app.post('/api/admin/settings', (req, res) => {
    const { downvotesEnabled, autoplayEnabled } = req.body;
    const db = getDB();

    if (!hasAdminAccess(req, db)) {
        return res.status(403).json({ error: 'Nicht autorisiert.' });
    }

    if (downvotesEnabled !== undefined) db.settings.downvotesEnabled = !!downvotesEnabled;
    if (autoplayEnabled !== undefined) db.settings.autoplayEnabled = !!autoplayEnabled;
    
    saveDB(db);
    io.emit('songs:updated');
    res.json(db.settings);
});

app.delete('/api/songs/:id', (req, res) => {
    const { id } = req.params;
    const db = getDB();
    
    if (!hasAdminAccess(req, db)) {
        return res.status(403).json({ error: 'Nur Moderatoren dürfen Lieder entfernen.' });
    }

    db.songs = db.songs.filter((s: any) => s.id !== id);
    saveDB(db);
    io.emit('songs:updated');
    res.json({ success: true });
});

app.get('/api/admin/stats', (req, res) => {
    const db = getDB();

    const stats = db.songs.map((song: any) => {
        const upvoters = (song.upvoters || []).map((vId: string) => {
            return db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' };
        });
        const downvoters = (song.downvoters || []).map((vId: string) => {
            return db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' };
        });
        
        // Group upvotes by department
        const byDepartmentUp: Record<string, string[]> = {};
        upvoters.forEach((v: any) => {
            const dept = v.department || 'Sonstige';
            if (!byDepartmentUp[dept]) byDepartmentUp[dept] = [];
            byDepartmentUp[dept].push(v.username);
        });

        // Group downvotes by department
        const byDepartmentDown: Record<string, string[]> = {};
        downvoters.forEach((v: any) => {
            const dept = v.department || 'Sonstige';
            if (!byDepartmentDown[dept]) byDepartmentDown[dept] = [];
            byDepartmentDown[dept].push(v.username);
        });

        return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            totalVotes: song.votes,
            upvotes: (song.upvoters || []).length,
            downvotes: (song.downvoters || []).length,
            requestedBy: song.requestedBy,
            departmentsUp: byDepartmentUp,
            departmentsDown: byDepartmentDown,
            status: song.status || 'requested'
        };
    }).sort((a: any, b: any) => b.totalVotes - a.totalVotes);

    const historyStats = Object.entries(db.history || {}).map(([uri, data]: [string, any]) => {
        const upvoters = (data.upvoters || []).map((vId: string) => {
            return db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' };
        });
        const downvoters = (data.downvoters || []).map((vId: string) => {
            return db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' };
        });

        const byDepartmentUp: Record<string, string[]> = {};
        upvoters.forEach((v: any) => {
            const dept = v.department || 'Sonstige';
            if (!byDepartmentUp[dept]) byDepartmentUp[dept] = [];
            byDepartmentUp[dept].push(v.username);
        });

        const byDepartmentDown: Record<string, string[]> = {};
        downvoters.forEach((v: any) => {
            const dept = v.department || 'Sonstige';
            if (!byDepartmentDown[dept]) byDepartmentDown[dept] = [];
            byDepartmentDown[dept].push(v.username);
        });

        return {
            id: uri,
            title: data.title || 'Unknown Title',
            artist: data.artist || 'Unknown Artist',
            totalVotes: data.votes,
            upvotes: (data.upvoters || []).length,
            downvotes: (data.downvoters || []).length,
            requestedBy: data.requestedBy,
            departmentsUp: byDepartmentUp,
            departmentsDown: byDepartmentDown,
            voters: {
                up: upvoters,
                down: downvoters
            },
            status: 'played'
        };
    }).sort((a: any, b: any) => b.totalVotes - a.totalVotes);

    res.json({ current: stats, history: historyStats });
});

// --- VITE MIDDLEWARE ---

async function start() {
    if (process.env.NODE_ENV !== 'production') {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: 'spa',
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(__dirname, 'dist')));
        app.get('*', (req, res) => {
            res.sendFile(path.join(__dirname, 'dist', 'index.html'));
        });
    }

    httpServer.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start();

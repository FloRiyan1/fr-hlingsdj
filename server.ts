import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import cookieParser from 'cookie-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

// Simple local database
const DB_PATH = path.join(__dirname, 'db.json');
if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({ songs: [], users: {} }));
}

function getDB() {
    return JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
}

function saveDB(data: any) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// Spotify config
const SPOTIFY_CLIENT_ID = process.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`;

// --- AUTH ROUTES ---

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

app.get(['/auth/callback', '/auth/callback/'], async (req, res) => {
    const { code } = req.query;
    if (!code) return res.redirect('/');

    try {
        const response = await axios.post('https://accounts.spotify.com/api/token', new URLSearchParams({
            grant_type: 'authorization_code',
            code: code as string,
            redirect_uri: REDIRECT_URI,
            client_id: SPOTIFY_CLIENT_ID!,
            client_secret: SPOTIFY_CLIENT_SECRET!,
        }), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });

        const { access_token, refresh_token, expires_in } = response.data;
        
        // In a real app, store this in a database linked to a session
        // For this demo, we'll set it in a cookie (not ideal for large tokens, but works for PoC)
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
    } catch (error) {
        res.status(500).send('Spotify token exchange failed');
    }
});

// --- SONG APP API ---

app.get('/api/songs', (req, res) => {
    const db = getDB();
    const sortedSongs = [...db.songs].sort((a, b) => b.votes - a.votes);
    res.json(sortedSongs);
});

app.post('/api/songs', (req, res) => {
    const { title, artist, albumArt, spotifyUri, requestedBy } = req.body;
    if (!title || !artist) return res.status(400).json({ error: 'Title and artist required' });

    const db = getDB();
    const newSong = {
        id: uuidv4(),
        title,
        artist,
        albumArt: albumArt || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=200&h=200&fit=crop',
        spotifyUri,
        requestedBy,
        votes: 0,
        voters: [], // User IDs who voted
        createdAt: new Date().toISOString()
    };
    db.songs.push(newSong);
    saveDB(db);
    res.json(newSong);
});

app.post('/api/songs/:id/vote', (req, res) => {
    const { userId } = req.body;
    const { id } = req.params;
    if (!userId) return res.status(401).json({ error: 'Not authenticated' });

    const db = getDB();
    const song = db.songs.find((s: any) => s.id === id);
    if (!song) return res.status(404).json({ error: 'Song not found' });

    if (song.voters.includes(userId)) {
        // Remove vote
        song.voters = song.voters.filter((id: string) => id !== userId);
        song.votes -= 1;
    } else {
        // Add vote
        song.voters.push(userId);
        song.votes += 1;
    }

    saveDB(db);
    res.json(song);
});

app.post('/api/songs/:id/queue', async (req, res) => {
    const { id } = req.params;
    const spotifyToken = req.cookies.spotify_token;

    if (!spotifyToken) {
        return res.status(401).json({ error: 'Spotify not connected' });
    }

    const db = getDB();
    const song = db.songs.find((s: any) => s.id === id);
    if (!song || !song.spotifyUri) {
        return res.status(400).json({ error: 'Song or Spotify URI not found' });
    }

    try {
        await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(song.spotifyUri)}`, {}, {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
        res.json({ success: true });
    } catch (error: any) {
        console.error('Spotify queue error:', error.response?.data || error.message);
        res.status(500).json({ error: 'Failed to add to Spotify queue' });
    }
});

app.get('/api/spotify/search', async (req, res) => {
    const { q } = req.query;
    const token = req.cookies.spotify_token;
    if (!token) return res.status(401).json({ error: 'Spotify not connected' });

    try {
        const response = await axios.get(`https://api.spotify.com/v1/search?q=${encodeURIComponent(q as string)}&type=track&limit=5`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        res.json(response.data.tracks.items);
    } catch (error) {
        res.status(500).json({ error: 'Spotify search failed' });
    }
});

app.get('/api/admin/stats', (req, res) => {
    const db = getDB();
    const stats = db.songs.map((song: any) => {
        const voterDetails = song.voters.map((vId: string) => {
            return db.users[vId] || { username: 'Unbekannt', department: 'Sonstige' };
        });
        
        // Group by department
        const byDepartment: Record<string, string[]> = {};
        voterDetails.forEach((v: any) => {
            const dept = v.department || 'Sonstige';
            if (!byDepartment[dept]) byDepartment[dept] = [];
            byDepartment[dept].push(v.username);
        });

        return {
            id: song.id,
            title: song.title,
            artist: song.artist,
            totalVotes: song.votes,
            requestedBy: song.requestedBy,
            departments: byDepartment
        };
    }).sort((a: any, b: any) => b.totalVotes - a.totalVotes);

    res.json(stats);
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

    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

start();

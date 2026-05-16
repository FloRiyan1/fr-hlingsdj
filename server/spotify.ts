import axios from 'axios';
import { getDB, saveDB } from './db.js';
import { Server as SocketServer } from 'socket.io';

export const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
export const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
export const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`;

let isQueueing = false;

export async function refreshAdminToken() {
    const db = getDB();
    if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !db.adminToken) return null;
    
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
        return access_token;
    } catch (error: any) {
        console.error('Spotify: Error refreshing token:', error.response?.data || error.message);
        return null;
    }
}

export async function getAdminSpotifyToken() {
    const db = getDB();
    if (!db.adminToken) return null;
    if (Date.now() > db.adminToken.expiresAt) return await refreshAdminToken();
    return db.adminToken.accessToken;
}

export async function checkAutoplay(io: SocketServer) {
    if (isQueueing) return;

    const db = getDB();
    if (!db.adminToken) return;

    try {
        const spotifyToken = await getAdminSpotifyToken();
        const response = await axios.get('https://api.spotify.com/v1/me/player', {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });

        const playback = response.data;
        
        const queueResponse = await axios.get('https://api.spotify.com/v1/me/player/queue', {
            headers: { 'Authorization': `Bearer ${spotifyToken}` }
        });
        const currentQueue = queueResponse.data?.queue || [];
        
        let dbChanged = false;
        db.songs.forEach((s: any) => {
            if (s.status === 'queued') {
                const isCurrentlyPlaying = playback?.item?.uri === s.spotifyUri;
                const isStillInQueue = currentQueue.some((item: any) => item.uri === s.spotifyUri);
                
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

        if (!db.settings.autoplayEnabled) return;

        const currentlyQueuedSentCount = db.songs.filter((s: any) => s.status === 'queued').length;
        if (currentlyQueuedSentCount > 0) return;

        const candidates = db.songs.filter((s: any) => s.status !== 'queued' && s.status !== 'played');
        if (candidates.length === 0) return;

        const topSong = candidates.sort((a, b) => {
            if (a.status === 'priority' && b.status !== 'priority') return -1;
            if (a.status !== 'priority' && b.status === 'priority') return 1;
            return b.votes - a.votes;
        })[0];

        if (!topSong) return;

        const isAlreadyInQueue = currentQueue.slice(0, 5).some((item: any) => item.uri === topSong.spotifyUri);

        let shouldQueue = false;
        if (!playback || !playback.item) {
            if (!isAlreadyInQueue) shouldQueue = true;
        } else {
            const timeLeft = playback.item.duration_ms - playback.progress_ms;
            if (timeLeft < 20000 && !isAlreadyInQueue && playback.item.uri !== topSong.spotifyUri) {
                shouldQueue = true;
            }
        }

        if (shouldQueue) {
            isQueueing = true;
            try {
                await axios.post(`https://api.spotify.com/v1/me/player/queue?uri=${encodeURIComponent(topSong.spotifyUri)}`, {}, {
                    headers: { 'Authorization': `Bearer ${spotifyToken}` }
                });
                topSong.status = 'queued';
                saveDB(db);
                io.emit('songs:updated');
            } finally {
                isQueueing = false;
            }
        }
    } catch (error: any) {
        // Silent fail
    }
}

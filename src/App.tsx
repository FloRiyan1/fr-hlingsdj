import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  Music, Plus, ThumbsUp, LogIn, Building2, User, Users, LogOut, 
  PlayCircle, CheckCircle2, AlertCircle, XCircle, Loader2, 
  ChevronUp, Trash2, Settings 
} from 'lucide-react';

import { UserProfile, Song, SpotifyTrack, PlaybackState } from './types.js';
import { Auth } from './components/Auth.js';
import { NowPlaying } from './components/NowPlaying.js';
import { SearchSection } from './components/SearchSection.js';
import { SongCard } from './components/SongCard.js';
import { AdminModal } from './components/AdminModal.js';
import { VoterModal } from './components/VoterModal.js';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('vibe_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [downvotesEnabled, setDownvotesEnabled] = useState(false);
  const [autoplayEnabled, setAutoplayEnabled] = useState(false);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [isAuthenticatedAdmin, setIsAuthenticatedAdmin] = useState(false);
  const [adminStats, setAdminStats] = useState<{ current: any[]; history: any[] }>({ current: [], history: [] });
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [currentPlayback, setCurrentPlayback] = useState<PlaybackState | null>(null);
  const [voterModalSong, setVoterModalSong] = useState<Song | any | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [tempUsername, setTempUsername] = useState('');
  const [tempDepartment, setTempDepartment] = useState('');
  const [newDeptName, setNewDeptName] = useState('');
  const [spotifyDebug, setSpotifyDebug] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(true);
  
  const searchRef = useRef<HTMLDivElement>(null);
  const adminTimerRef = useRef<NodeJS.Timeout | null>(null);

  const refreshSpotifyStatus = useCallback(async () => {
    try {
      const statusRes = await fetch('/api/spotify/status');
      if (statusRes.ok) {
        const { connected } = await statusRes.json();
        setIsSpotifyConnected(connected);
      }
      
      const debugRes = await fetch('/api/admin/debug-spotify');
      if (debugRes.ok) {
        setSpotifyDebug(await debugRes.json());
      }
    } catch (err) { 
      console.error('Refresh status error', err); 
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        refreshSpotifyStatus();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [refreshSpotifyStatus]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/songs');
      if (res.ok) {
        const data = await res.json();
        setSongs(data.songs || []);
        setDownvotesEnabled(data.settings?.downvotesEnabled || false);
        setAutoplayEnabled(data.settings?.autoplayEnabled || false);
      }
    } catch (err) { console.error('Songs fetch error', err); }
  }, []);

  const fetchPlayback = useCallback(async () => {
    try {
      const res = await fetch('/api/player/current');
      if (res.ok) {
        const data = await res.json();
        setCurrentPlayback(data.playback);
      }
    } catch (err) { console.error('Playback fetch error', err); }
  }, []);

  const fetchAdminStats = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users')
      ]);
      if (statsRes.ok) setAdminStats(await statsRes.json());
      if (usersRes.ok) setAdminUsers(await usersRes.json());
    } catch (err) { console.error('Admin stats fetch error'); }
  }, []);

  useEffect(() => {
    // Initial fetch
    fetchSongs();
    fetchPlayback();
    fetch('/api/departments').then(res => res.json()).then(data => {
      setDepartments(data);
      if (data.length > 0) setTempDepartment(prev => prev || data[0]);
    }).catch(() => {});
    fetch('/api/admin/users').then(res => res.json()).then(setAdminUsers).catch(() => {});
  }, [fetchSongs, fetchPlayback]);

  const [isSocketConnected, setIsSocketConnected] = useState(false);

  useEffect(() => {
    const socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
    
    socket.on('connect', () => {
      console.log('Socket: Verbunden mit ID:', socket.id);
      setIsSocketConnected(true);
      fetchSongs();
      fetchPlayback();
    });

    socket.on('disconnect', (reason) => {
      console.warn('Socket: Getrennt - Grund:', reason);
      setIsSocketConnected(false);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket: Verbindungsfehler:', err.message);
    });
    
    socket.on('songs:updated', () => {
      console.log('Socket Event: songs:updated');
      fetchSongs();
    });

    socket.on('playback:updated', (data) => {
      console.log('Socket Event: playback:updated', data);
      if (data && data.playback !== undefined) {
        setCurrentPlayback(data.playback);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [fetchSongs, fetchPlayback]);

  // Separate effect for admin updates to not trigger socket reconnects
  useEffect(() => {
    if (isAdminOpen && isAuthenticatedAdmin) {
      refreshSpotifyStatus();
      fetchAdminStats();
    }
  }, [isAdminOpen, isAuthenticatedAdmin, refreshSpotifyStatus, fetchAdminStats]);

  // Fallback polling if socket is disconnected
  useEffect(() => {
    const interval = setInterval(() => {
      if (!isSocketConnected) {
        console.log('Socket disconnected, performing fallback fetch...');
        fetchSongs();
        fetchPlayback();
      }
    }, 10000); // Every 10 seconds
    return () => clearInterval(interval);
  }, [isSocketConnected, fetchSongs, fetchPlayback]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tempUsername || !tempDepartment) return;
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: tempUsername, department: tempDepartment }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        localStorage.setItem('vibe_user', JSON.stringify(data));
      }
    } catch (err) { setError('Login failed.'); }
  };

  const verifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    try {
      const res = await fetch('/api/admin/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin: pinInput }),
      });
      if (res.ok) {
        setIsAuthenticatedAdmin(true);
        setShowPinPrompt(false);
        setIsAdminOpen(true);
        setPinInput('');
      } else { setError('Falscher PIN'); setPinInput(''); }
    } catch (err) { setError('Verbindung fehlgeschlagen'); }
  };

  const handleLogout = () => { setUser(null); localStorage.removeItem('vibe_user'); };

  const searchSpotify = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) setSearchResults(data);
      else setError(data.details || 'Suche fehlgeschlagen');
    } catch (err) { setError('Search failed.'); }
    finally { setIsSearching(false); }
  };

  const addSong = async (track: SpotifyTrack) => {
    if (!user) return;
    try {
      const res = await fetch('/api/songs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: track.name,
          artist: track.artists.map(a => a.name).join(', '),
          albumArt: track.album.images[0]?.url,
          spotifyUri: track.uri,
          requestedBy: user.username
        }),
      });
      if (res.ok) fetchSongs();
    } catch (err) { setError('Failed to add song.'); }
  };

  const voteSong = async (songId: string, type: 'up' | 'down') => {
    if (!user) return;
    try {
      const res = await fetch(`/api/songs/${songId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId, type }),
      });
      if (res.ok) fetchSongs();
    } catch (err) { console.error('Vote failed'); }
  };

  const handleAdminPressStart = () => {
    adminTimerRef.current = setTimeout(() => {
      setIsAdminMode(true);
      if (!isAuthenticatedAdmin) setShowPinPrompt(true);
      else setIsAdminOpen(true);
    }, 2500);
  };

  if (!user) return (
    <Auth 
      username={tempUsername} setUsername={setTempUsername}
      department={tempDepartment} setDepartment={setTempDepartment}
      departments={departments} onLogin={handleLogin} error={error}
    />
  );

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans">
      <header className="sticky top-0 z-50 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-default" onMouseDown={handleAdminPressStart} onMouseUp={() => clearTimeout(adminTimerRef.current!)}>
            <Music className="w-6 h-6 text-red-600" />
            <span className="font-bold text-xl tracking-tight">pds <span className="font-light">Frühlingsmix</span></span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="flex items-center gap-2 pr-2 border-r border-white/5">
              <div 
                className={`w-2 h-2 rounded-full ${isSocketConnected ? 'bg-green-500 shadow-[0_0_8px_#22c55e]' : 'bg-red-500 animate-pulse'}`}
                title={isSocketConnected ? 'Live-Verbindung aktiv' : 'Verbindung getrennt - Fallback aktiv'}
              />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest hidden xs:inline">
                {isSocketConnected ? 'Live' : 'Sync'}
              </span>
            </div>
            
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-400 font-medium hidden sm:inline">{user.username}</span>
              <button 
                onClick={() => { fetchSongs(); fetchPlayback(); }}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                title="Aktualisieren"
              >
                <Loader2 className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-white" title="Abmelden"><LogOut className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        <NowPlaying playback={currentPlayback} onShowVoters={setVoterModalSong} downvotesEnabled={downvotesEnabled} />
        
        <SearchSection 
          searchRef={searchRef}
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} 
          onSearch={searchSpotify} isSearching={isSearching} 
          searchResults={searchResults} onAddSong={addSong} 
          onVote={voteSong} songs={songs} user={user} 
          downvotesEnabled={downvotesEnabled} 
          onClear={() => { setSearchQuery(''); setSearchResults([]); }}
        />

        <section>
          <div className="flex items-center justify-between mb-6">
             <h2 className="text-lg font-bold flex items-center gap-2"><Music className="w-5 h-5 text-red-600" />Warteschlange</h2>
             <span className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em]">{songs.filter(s => s.status !== 'played').length} Wunsch</span>
          </div>
          <div className="space-y-4">
            {songs.filter(s => s.status !== 'played').sort((a,b) => {
              if (a.status === 'queued' && b.status !== 'queued') return -1;
              if (a.status !== 'queued' && b.status === 'queued') return 1;
              if (a.status === 'priority' && b.status !== 'priority') return -1;
              if (a.status !== 'priority' && b.status === 'priority') return 1;
              return b.votes - a.votes;
            }).map((song) => (
              <SongCard 
                key={song.id} song={song} user={user} 
                isAdminMode={isAdminMode} isAuthenticatedAdmin={isAuthenticatedAdmin} 
                downvotesEnabled={downvotesEnabled} onVote={voteSong} 
                onDelete={id => fetch(`/api/songs/${id}`, { method: 'DELETE' }).then(fetchSongs)} 
                onQueue={id => fetch(`/api/songs/${id}/queue`, { method: 'POST' }).then(fetchSongs)} 
                onShowVoters={setVoterModalSong}
              />
            ))}
          </div>
        </section>
      </main>

      <AdminModal 
        isOpen={isAdminOpen} onClose={() => setIsAdminOpen(false)}
        isSpotifyConnected={isSpotifyConnected}
        onConnectSpotify={async () => {
          const res = await fetch('/api/auth/spotify/url');
          const { url } = await res.json();
          window.open(url, 'Spotify', 'width=600,height=800');
        }}
        onDisconnectSpotify={() => fetch('/api/auth/spotify/logout', { method: 'POST' }).then(refreshSpotifyStatus)}
        downvotesEnabled={downvotesEnabled} onToggleDownvotes={val => fetch('/api/admin/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({downvotesEnabled: val}) }).then(res => res.json()).then(d => setDownvotesEnabled(d.downvotesEnabled))}
        autoplayEnabled={autoplayEnabled} onToggleAutoplay={val => fetch('/api/admin/settings', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({autoplayEnabled: val}) }).then(res => res.json()).then(d => setAutoplayEnabled(d.autoplayEnabled))}
        spotifyDebug={spotifyDebug} onRefreshDebug={() => fetch('/api/admin/debug-spotify').then(res => res.json()).then(setSpotifyDebug)}
        showDebug={showDebug} onToggleDebug={() => setShowDebug(!showDebug)}
        departments={departments} newDeptName={newDeptName} setNewDeptName={setNewDeptName}
        onAddDept={() => fetch('/api/admin/departments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({departments: [...departments, newDeptName]}) }).then(() => {setDepartments([...departments, newDeptName]); setNewDeptName('');})}
        onRemoveDept={name => fetch('/api/admin/departments', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({departments: departments.filter(d => d !== name)}) }).then(() => setDepartments(departments.filter(d => d !== name)))}
        adminUsers={adminUsers} onToggleModerator={(id, en) => fetch(`/api/admin/users/${id}/moderator`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({enabled: en}) }).then(fetchAdminStats)}
        adminStats={adminStats} onShowVoters={setVoterModalSong}
      />

      <VoterModal song={voterModalSong} onClose={() => setVoterModalSong(null)} downvotesEnabled={downvotesEnabled} />

      <AnimatePresence>
        {showPinPrompt && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div className="w-full max-w-sm bg-[#181818] p-8 rounded-3xl border border-white/10 shadow-2xl relative">
              <button onClick={() => setShowPinPrompt(false)} className="absolute top-4 right-4 text-gray-500">✕</button>
              <h2 className="text-xl font-bold mb-6 text-center">Admin Zugang</h2>
              <form onSubmit={verifyPin} className="space-y-4">
                <input autoFocus type="password" value={pinInput} onChange={e => setPinInput(e.target.value)} placeholder="PIN" className="w-full bg-[#242424] rounded-xl py-4 text-center text-2xl font-black outline-none" />
                <button type="submit" className="w-full bg-red-600 font-bold py-4 rounded-xl">Bestätigen</button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]" onClick={() => setError(null)}>
            <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3 cursor-pointer">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-bold">{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

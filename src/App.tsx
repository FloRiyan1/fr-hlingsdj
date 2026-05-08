/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Music, 
  Search, 
  Plus, 
  ThumbsUp, 
  LogIn, 
  Building2, 
  User, 
  Users,
  LogOut, 
  PlayCircle, 
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronUp
} from 'lucide-react';

interface UserProfile {
  username: string;
  department: string;
  userId: string;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  albumArt: string;
  spotifyUri: string;
  requestedBy: string;
  votes: number;
  voters: string[];
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(() => {
    const saved = localStorage.getItem('vibe_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [songs, setSongs] = useState<Song[]>([]);
  const [isSpotifyConnected, setIsSpotifyConnected] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [adminStats, setAdminStats] = useState<any[]>([]);

  // Auth fields
  const [tempUsername, setTempUsername] = useState('');
  const [tempDepartment, setTempDepartment] = useState('');

  const fetchSongs = useCallback(async () => {
    try {
      const res = await fetch('/api/songs');
      if (res.ok) {
        const data = await res.json();
        setSongs(data);
      }
    } catch (err) {
      console.error('Failed to fetch songs', err);
    }
  }, []);

  const fetchAdminStats = async () => {
    try {
      const res = await fetch('/api/admin/stats');
      if (res.ok) {
        const data = await res.json();
        setAdminStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin stats');
    }
  };

  useEffect(() => {
    if (isAdminOpen) fetchAdminStats();
  }, [isAdminOpen]);

  useEffect(() => {
    fetchSongs();
    const interval = setInterval(fetchSongs, 10000); // Poll every 10s

    // Sync user data to server for admin stats
    if (user) {
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      }).catch(console.error);
    }

    return () => clearInterval(interval);
  }, [fetchSongs, user]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'OAUTH_AUTH_SUCCESS') {
        setIsSpotifyConnected(true);
        // Maybe refresh some state
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
    } catch (err) {
      setError('Login failed. Please try again.');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('vibe_user');
  };

  const connectSpotify = async () => {
    try {
      const res = await fetch('/api/auth/spotify/url');
      const { url, error } = await res.json();
      if (error) {
        setError(error);
        return;
      }
      window.open(url, 'Spotify Login', 'width=600,height=800');
    } catch (err) {
      setError('Failed to connect to Spotify. Check environment variables.');
    }
  };

  const searchSpotify = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
      } else {
        setError('Spotify search failed. Is Spotify connected?');
      }
    } catch (err) {
      setError('Search error occurred.');
    } finally {
      setIsSearching(false);
    }
  };

  const addSong = async (track: SpotifyTrack) => {
    if (!user) return;
    setLoading(true);
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
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        fetchSongs();
      }
    } catch (err) {
      setError('Failed to add song.');
    } finally {
      setLoading(false);
    }
  };

  const voteSong = async (songId: string) => {
    if (!user) return;
    try {
      const res = await fetch(`/api/songs/${songId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.userId }),
      });
      if (res.ok) fetchSongs();
    } catch (err) {
      console.error('Vote failed');
    }
  };

  const queueSong = async (songId: string) => {
    try {
      const res = await fetch(`/api/songs/${songId}/queue`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert('Added to Spotify queue!');
      } else {
        setError(data.error || 'Failed to queue song.');
      }
    } catch (err) {
      setError('Queue error occurred.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-[#181818] rounded-2xl p-8 border border-white/10 shadow-2xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(227,6,19,0.3)]">
              <Music className="w-8 h-8 text-white font-bold" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">pds Frühlingsmix</h1>
            <p className="text-gray-400 mt-2 text-center text-sm">Welcome! Please authenticate to start requesting songs.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 px-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  value={tempUsername}
                  onChange={e => setTempUsername(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-[#242424] border border-transparent focus:border-red-600/50 rounded-lg py-3 pl-10 pr-4 outline-none transition-all placeholder:text-gray-600"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 px-1">Department</label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                  type="text" 
                  value={tempDepartment}
                  onChange={e => setTempDepartment(e.target.value)}
                  placeholder="e.g. Engineering, HR"
                  className="w-full bg-[#242424] border border-transparent focus:border-red-600/50 rounded-lg py-3 pl-10 pr-4 outline-none transition-all placeholder:text-gray-600"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-red-600/10"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#121212] text-white font-sans selection:bg-green-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#121212]/80 backdrop-blur-md border-bottom border-white/5 py-4 px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Music className="w-6 h-6 text-red-600" />
            <span className="font-bold text-xl tracking-tight">pds <span className="font-light">Frühlingsmix</span></span>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-xs font-medium text-gray-300">{user.username} • {user.department}</span>
            </div>
            
            <button 
              onClick={connectSpotify}
              className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-black border border-white/10 hover:border-red-600/50 px-4 py-2 rounded-full transition-colors active:scale-95"
            >
              <PlayCircle className="w-4 h-4 text-red-600" />
              Connect Spotify
            </button>

            <button 
              onClick={() => setIsAdminOpen(true)}
              className="p-2 text-gray-400 hover:text-white transition-colors flex items-center gap-2"
              title="Admin Panel"
            >
              <Users className="w-5 h-5 text-red-600" />
              <span className="hidden md:inline text-xs font-bold uppercase tracking-wider">Admin</span>
            </button>

            <button 
              onClick={handleLogout}
              className="p-2 text-gray-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-10 px-6">
        {/* Search / Add Section */}
        <section className="mb-12">
          <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-red-600" />
            Lied anfragen
          </h2>
          <div className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input 
                type="text"
                placeholder="Search track on Spotify..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSpotify()}
                className="w-full bg-[#1e1e1e] border border-white/5 focus:border-white/20 rounded-xl py-4 pl-12 pr-4 outline-none transition-all placeholder:text-gray-600 shadow-xl"
              />
            </div>
            <button 
              onClick={searchSpotify}
              disabled={isSearching}
              className="bg-white text-black font-bold px-6 rounded-xl hover:bg-gray-200 transition-all active:scale-95 disabled:opacity-50"
            >
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Search'}
            </button>
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-[#1e1e1e] rounded-xl border border-white/10 overflow-hidden mb-8 shadow-2xl"
              >
                {searchResults.map((track) => (
                  <div 
                    key={track.id}
                    className="flex items-center justify-between p-4 hover:bg-white/5 border-b border-white/5 last:border-0 group"
                  >
                    <div className="flex items-center gap-4">
                      <img src={track.album.images[0]?.url} alt="" className="w-12 h-12 rounded shadow-lg" />
                      <div>
                        <div className="font-bold text-sm line-clamp-1">{track.name}</div>
                        <div className="text-xs text-gray-400">{track.artists.map(a => a.name).join(', ')}</div>
                      </div>
                    </div>
                    <button 
                      onClick={() => addSong(track)}
                      className="p-2 rounded-full hover:bg-red-600 hover:text-white transition-all group-hover:bg-red-600/20"
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* List Section */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Music className="w-5 h-5 text-red-600" />
              Warteschlange & Stimmen
            </h2>
            <div className="text-xs text-gray-500 uppercase tracking-widest font-semibold">{songs.length} Lieder angefragt</div>
          </div>

          <div className="space-y-4">
            <AnimatePresence mode="popLayout">
              {songs.length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-20 bg-white/5 rounded-2xl border border-dashed border-white/10"
                >
                  <Music className="w-12 h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-gray-500">No songs yet. Be the first to suggest something!</p>
                </motion.div>
              ) : (
                songs.map((song, index) => (
                  <motion.div
                    key={song.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: 'spring', stifness: 300, damping: 30 }}
                    className="group relative flex items-center justify-between p-4 bg-[#181818] hover:bg-[#202020] rounded-xl border border-white/5 transition-colors shadow-lg"
                  >
                    <div className="flex items-center gap-5 flex-1 min-w-0">
                      <div className="relative group/art">
                        <img src={song.albumArt} alt="" className="w-16 h-16 rounded-lg object-cover shadow-2xl transition-transform group-hover/art:scale-105" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 flex items-center justify-center transition-opacity rounded-lg">
                          <PlayCircle className="w-6 h-6" />
                        </div>
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-base truncate pr-4">{song.title}</div>
                        <div className="text-sm text-gray-400 truncate pr-4">{song.artist}</div>
                        <div className="mt-2 flex items-center gap-2">
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-gray-500 uppercase tracking-wider border border-white/5">
                            {song.requestedBy}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <button 
                         onClick={() => queueSong(song.id)}
                         className="opacity-0 group-hover:opacity-100 flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-red-600 text-white px-3 py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-red-600/20"
                      >
                         <ChevronUp className="w-4 h-4" />
                         Queue
                      </button>

                      <div className="flex flex-col items-center">
                        <button 
                          onClick={() => voteSong(song.id)}
                          className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all active:scale-90 border ${
                            song.voters.includes(user.userId) 
                            ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                            : 'bg-white/5 border-white/5 hover:border-white/20 text-gray-400 hover:text-white'
                          }`}
                        >
                          <ThumbsUp className={`w-5 h-5 ${song.voters.includes(user.userId) ? 'fill-white' : ''}`} />
                        </button>
                        <span className={`text-xs mt-1 font-bold ${song.voters.includes(user.userId) ? 'text-red-500' : 'text-gray-500'}`}>
                          {song.votes}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </section>
      </main>

      {/* Admin Modal */}
      <AnimatePresence>
        {isAdminOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[#181818] border border-white/10 w-full max-w-2xl max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#202020]">
                <h2 className="text-xl font-bold flex items-center gap-3">
                  <Users className="w-6 h-6 text-red-600" />
                  Stimmen-Auswertung (Abteilung)
                </h2>
                <button onClick={() => setIsAdminOpen(false)} className="text-gray-500 hover:text-white">✕</button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {adminStats.map((song) => (
                  <div key={song.id} className="bg-white/5 rounded-2xl p-5 border border-white/5">
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h3 className="font-bold text-lg">{song.title}</h3>
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <span>{song.artist}</span>
                          <span className="text-[10px] bg-white/10 px-1.5 rounded uppercase">Anfrage von: {song.requestedBy}</span>
                        </div>
                      </div>
                      <div className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                        {song.totalVotes} Stimmen
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {Object.entries(song.departments).map(([dept, voters]) => (
                        <div key={dept} className="bg-black/20 rounded-xl p-3 border border-white/5">
                          <div className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">{dept}</div>
                          <div className="text-sm text-gray-300">
                            { (voters as string[]).join(', ') }
                          </div>
                        </div>
                      ))}
                    </div>
                    {Object.keys(song.departments).length === 0 && (
                      <p className="text-xs text-gray-600 italic">Noch keine Stimmen abgegeben.</p>
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Global Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100]"
          >
            <div className="bg-red-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
              <AlertCircle className="w-5 h-5" />
              <span className="text-sm font-bold">{error}</span>
              <button onClick={() => setError(null)} className="ml-2 hover:opacity-70">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

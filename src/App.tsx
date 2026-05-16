/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io } from 'socket.io-client';
import { 
  Music, 
  Search, 
  Plus, 
  ThumbsUp,
  ThumbsDown, 
  LogIn, 
  Building2, 
  User, 
  Users,
  LogOut, 
  PlayCircle, 
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  ChevronUp,
  Trash2,
  Settings
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
  upvoters: string[];
  downvoters: string[];
  status?: 'requested' | 'priority' | 'queued';
  voters?: {
    up: { username: string; department: string }[];
    down: { username: string; department: string }[];
  };
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album: { images: { url: string }[] };
  uri: string;
}

interface PlaybackState {
  item: {
    name: string;
    artists: string[];
    albumArt: string;
    duration_ms: number;
    uri: string;
  };
  progress_ms: number;
  is_playing: boolean;
  voterInfo: {
    requestedBy: string;
    votes: number;
    voters: {
      up: { username: string; department: string }[];
      down: { username: string; department: string }[];
    };
  } | null;
}

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
  const isCurrentUserModerator = adminUsers.find(u => u.id === user?.userId)?.isModerator || (user?.username.toLowerCase() === 'admin' && user?.department.toLowerCase() === 'dev');
  const [currentPlayback, setCurrentPlayback] = useState<PlaybackState | null>(null);
  const [voterModalSong, setVoterModalSong] = useState<Song | any | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const adminTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleAdminPressStart = () => {
    adminTimerRef.current = setTimeout(() => {
      setIsAdminMode(true);
      if (!isAuthenticatedAdmin) {
        setShowPinPrompt(true);
      } else {
        setIsAdminOpen(true);
      }
      // Haptic feedback if available for mobile users
      if (window.navigator && window.navigator.vibrate) {
         window.navigator.vibrate(200);
      }
    }, 2500); 
  };

  const handleAdminPressEnd = () => {
    if (adminTimerRef.current) {
      clearTimeout(adminTimerRef.current);
    }
  };

  // Helper to group voters by department
  const groupVotersByDept = (voters: { username: string; department: string }[]) => {
    return voters.reduce((acc, v) => {
      const dept = v.department || 'Sonstige';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(v.username);
      return acc;
    }, {} as Record<string, string[]>);
  };

  // Auth fields
  const [tempUsername, setTempUsername] = useState('');
  const [tempDepartment, setTempDepartment] = useState('');

  const fetchSongs = useCallback(async () => {
    try {
      const [songsRes, statusRes, deptRes] = await Promise.all([
        fetch('/api/songs'),
        fetch('/api/spotify/status'),
        fetch('/api/departments')
      ]);

      if (songsRes.ok) {
        const data = await songsRes.json();
        setSongs(data.songs || []);
        setDownvotesEnabled(data.settings?.downvotesEnabled || false);
        setAutoplayEnabled(data.settings?.autoplayEnabled || false);
      }
      if (statusRes.ok) {
        const { connected } = await statusRes.json();
        setIsSpotifyConnected(connected);
      }
      if (deptRes.ok) {
        const data = await deptRes.json();
        setDepartments(data);
        if (data.length > 0 && !tempDepartment) {
          setTempDepartment(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to fetch data', err);
    }
  }, [tempDepartment]);

  const fetchPlayback = useCallback(async () => {
    try {
      const res = await fetch('/api/player/current');
      if (res.ok) {
        const data = await res.json();
        setCurrentPlayback(data.playback);
      }
    } catch (err) {
      console.error('Failed to fetch playback', err);
    }
  }, []);

  useEffect(() => {
    fetchSongs();
    fetchPlayback();
    
    // Also fetch users initially to know moderator status
    fetch('/api/admin/users')
      .then(res => res.json())
      .then(data => setAdminUsers(data))
      .catch(() => {});

    return () => {};
  }, [fetchSongs, fetchPlayback]);

  const fetchAdminStats = useCallback(async () => {
    try {
      const [statsRes, usersRes] = await Promise.all([
        fetch('/api/admin/stats'),
        fetch('/api/admin/users')
      ]);
      if (statsRes.ok) {
        const data = await statsRes.json();
        setAdminStats(data);
      }
      if (usersRes.ok) {
        const data = await usersRes.json();
        setAdminUsers(data);
      }
    } catch (err) {
      console.error('Failed to fetch admin data');
    }
  }, []);

  useEffect(() => {
    const socket = io();
    socket.on('songs:updated', () => {
      fetchSongs();
      if (isAdminOpen) fetchAdminStats();
    });
    socket.on('playback:updated', (data) => {
      setCurrentPlayback(data.playback);
    });
    return () => {
      socket.disconnect();
    };
  }, [fetchSongs, isAdminOpen, fetchAdminStats]);

  useEffect(() => {
    if (isAdminOpen) {
      fetchAdminStats();
    }
  }, [isAdminOpen, fetchAdminStats]);

  useEffect(() => {
    // Sync user data to server for admin stats
    if (user) {
      fetch('/api/auth/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      }).catch(console.error);
    }
  }, [user]);

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

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
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
      } else {
        setError('Falscher PIN');
        setPinInput('');
      }
    } catch (err) {
      setError('Verbindung zum Server fehlgeschlagen');
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
  
  const disconnectSpotify = async () => {
    try {
      const res = await fetch('/api/auth/spotify/logout', { method: 'POST' });
      if (res.ok) {
        setIsSpotifyConnected(false);
        setError('Spotify Verbindung getrennt.');
        setTimeout(() => setError(null), 3000);
      }
    } catch (err) {
      setError('Fehler beim Trennen der Verbindung.');
    }
  };

  const searchSpotify = async () => {
    if (!searchQuery) return;
    setIsSearching(true);
    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) {
        setSearchResults(data);
      } else {
        console.error('Spotify Search API Error:', data);
        setError(data.details ? `Spotify Suche: ${data.details}` : (data.error || 'Suche fehlgeschlagen.'));
      }
    } catch (err) {
      setError('Verbindung zur Suche fehlgeschlagen.');
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
        fetchSongs();
        // Removed: setSearchQuery('');
        // Removed: setSearchResults([]);
      }
    } catch (err) {
      setError('Failed to add song.');
    } finally {
      setLoading(false);
    }
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
    } catch (err) {
      console.error('Vote failed');
    }
  };

  const toggleDownvotes = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ downvotesEnabled: enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setDownvotesEnabled(data.downvotesEnabled);
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const toggleAutoplay = async (enabled: boolean) => {
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoplayEnabled: enabled }),
      });
      if (res.ok) {
        const data = await res.json();
        setAutoplayEnabled(data.autoplayEnabled);
      }
    } catch (err) {
      setError('Failed to update settings');
    }
  };

  const [newDeptName, setNewDeptName] = useState('');
  const addDepartment = async () => {
    if (!newDeptName.trim()) return;
    const newDepts = [...departments, newDeptName.trim()];
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: newDepts }),
      });
      if (res.ok) {
        setDepartments(newDepts);
        setNewDeptName('');
      }
    } catch (err) {
      setError('Failed to add department');
    }
  };

  const removeDepartment = async (name: string) => {
    const newDepts = departments.filter(d => d !== name);
    try {
      const res = await fetch('/api/admin/departments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ departments: newDepts }),
      });
      if (res.ok) {
        setDepartments(newDepts);
      }
    } catch (err) {
      setError('Failed to remove department');
    }
  };

  const toggleModerator = async (userId: string, enabled: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/moderator`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });
      if (res.ok) {
        fetchAdminStats();
      }
    } catch (err) {
      setError('Failed to update moderator status');
    }
  };

  const deleteSong = async (songId: string) => {
    try {
      const res = await fetch(`/api/songs/${songId}`, { method: 'DELETE' });
      if (res.ok) fetchSongs();
    } catch (err) {
      setError('Fehler beim Löschen des Liedes.');
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

  const [spotifyDebug, setSpotifyDebug] = useState<any>(null);
  const fetchSpotifyDebug = async () => {
    try {
      const res = await fetch('/api/admin/debug-spotify');
      if (res.ok) {
        setSpotifyDebug(await res.json());
      }
    } catch (err) {
      console.error('Failed to fetch spotify debug');
    }
  };

  useEffect(() => {
    if (isAdminOpen && isAuthenticatedAdmin) {
      fetchSpotifyDebug();
    }
  }, [isAdminOpen, isAuthenticatedAdmin]);

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
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
                <select 
                  value={tempDepartment}
                  onChange={e => setTempDepartment(e.target.value)}
                  className="w-full bg-[#242424] border border-transparent focus:border-red-600/50 rounded-lg py-3 pl-10 pr-4 outline-none transition-all text-white appearance-none cursor-pointer"
                  required
                >
                  <option value="" disabled>Wähle deine Abteilung</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                  <option value="Sonstige">Sonstige</option>
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <ChevronUp className="w-4 h-4 text-gray-500 rotate-180" />
                </div>
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
      <header className="sticky top-0 z-50 bg-[#121212]/80 backdrop-blur-md border-b border-white/5 py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2 sm:gap-3 cursor-default select-none"
            onMouseDown={handleAdminPressStart}
            onMouseUp={handleAdminPressEnd}
            onMouseLeave={handleAdminPressEnd}
            onTouchStart={handleAdminPressStart}
            onTouchEnd={handleAdminPressEnd}
          >
            <Music className="w-5 h-5 sm:w-6 sm:h-6 text-red-600" />
            <span className="font-bold text-lg sm:text-xl tracking-tight">pds <span className="font-light">Frühlingsmix</span></span>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden xs:flex items-center gap-2 px-2 sm:px-3 py-1 sm:py-1.5 bg-white/5 rounded-full border border-white/10">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-600 animate-pulse" />
              <span className="text-[10px] sm:text-xs font-medium text-gray-300 truncate max-w-[80px] sm:max-w-none">{user.username}</span>
            </div>
            
            {!isSpotifyConnected && isAdminMode && isAuthenticatedAdmin && (
              <button 
                onClick={connectSpotify}
                className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-bold uppercase tracking-wider bg-black border border-white/10 hover:border-red-600/50 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full transition-colors active:scale-95"
              >
                <PlayCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-600" />
                <span className="hidden xs:inline">Admin: Spotify</span>
                <span className="xs:hidden">Admin</span>
              </button>
            )}
            
            {isSpotifyConnected && (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 rounded-full border border-green-500/20 text-green-500">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="text-[10px] font-bold uppercase tracking-wider hidden xs:inline">Spotify Aktiv</span>
              </div>
            )}

            <button 
              onClick={handleLogout}
              className="p-1.5 sm:p-2 text-gray-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto py-6 sm:py-10 px-4 sm:px-6">
        {/* Now Playing Section */}
        <AnimatePresence>
          {currentPlayback && (
            <motion.section 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="mb-10 sm:mb-14 overflow-hidden"
            >
              <div className="bg-[#181818] rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
                {/* Progress Bar Background */}
                <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5" />
                {/* Moving Progress Bar */}
                <motion.div 
                   className="absolute bottom-0 left-0 h-1 bg-red-600 shadow-[0_0_10px_#e30613]"
                   initial={false}
                   animate={{ width: `${(currentPlayback.progress_ms / currentPlayback.item.duration_ms) * 100}%` }}
                   transition={{ duration: 0.5, ease: "linear" }}
                />

                <div className="p-5 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
                  {/* Album Art Wrapper */}
                  <div className="relative group shrink-0">
                    <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full scale-150 opacity-50 group-hover:opacity-80 transition-opacity" />
                    <img 
                      src={currentPlayback.item.albumArt} 
                      alt="" 
                      className="w-32 h-32 sm:w-44 sm:h-44 rounded-2xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 border border-white/5" 
                    />
                    {currentPlayback.is_playing && (
                      <div className="absolute -bottom-2 -right-2 z-20 bg-red-600 p-2 rounded-full shadow-lg border-2 border-[#181818]">
                        <PlayCircle className="w-6 h-6 text-white animate-pulse" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 text-center sm:text-left relative z-10">
                    <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                       <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 animate-pulse">Now Playing</span>
                    </div>
                    <h2 className="text-2xl sm:text-4xl font-black mb-2 tracking-tight line-clamp-1">{currentPlayback.item.name}</h2>
                    <p className="text-base sm:text-xl text-gray-400 font-medium mb-4">{currentPlayback.item.artists.join(', ')}</p>
                    
                    {currentPlayback.voterInfo && (
                      <motion.button 
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setVoterModalSong({ 
                          title: currentPlayback.item.name, 
                          artist: currentPlayback.item.artists.join(', '),
                          voters: currentPlayback.voterInfo?.voters 
                        })}
                        className="inline-flex flex-wrap items-center justify-center sm:justify-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors text-left"
                      >
                        <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                           <div className="w-8 h-8 rounded-full bg-red-600/10 flex items-center justify-center">
                              <ThumbsUp className="w-4 h-4 text-red-600" />
                           </div>
                           <span className="text-lg font-black text-white">{currentPlayback.voterInfo.votes}</span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-gray-500 font-medium">Ansehen</span>
                          <Users className="w-3 h-3 text-gray-600" />
                        </div>
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.section>
          )}
        </AnimatePresence>


        {/* Search / Add Section */}
        <section className="mb-8 sm:mb-12" ref={searchRef}>
          <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
            Lied anfragen
          </h2>
          <div className="relative mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              <input 
                type="text"
                placeholder="Lied oder Interpret suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchSpotify()}
                className="w-full bg-[#1e1e1e] border border-white/5 focus:border-red-600/30 rounded-2xl py-4 sm:py-5 pl-11 sm:pl-12 pr-14 outline-none transition-all placeholder:text-gray-600 shadow-xl text-sm sm:text-base"
              />
              <button 
                onClick={searchSpotify}
                disabled={isSearching || !searchQuery}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all active:scale-95 disabled:opacity-30 disabled:grayscale flex items-center justify-center shadow-lg shadow-red-600/20"
              >
                {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="bg-[#1e1e1e] rounded-xl border border-white/10 overflow-hidden mb-8 shadow-2xl relative z-40"
              >
                {searchResults.map((track) => (
                  <div 
                    key={track.id}
                    className="flex items-center justify-between p-3 sm:p-4 hover:bg-white/5 border-b border-white/5 last:border-0 group"
                  >
                    <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                      <img src={track.album.images[0]?.url} alt="" className="w-10 h-10 sm:w-12 sm:h-12 rounded shadow-lg shrink-0" />
                      <div className="min-w-0">
                        <div className="font-bold text-xs sm:text-sm line-clamp-1">{track.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</div>
                      </div>
                    </div>
                    {(() => {
                      const songInList = songs.find(s => s.spotifyUri === track.uri);
                      if (songInList) {
                        return (
                          <div className="flex items-center gap-2">
                             <div className="flex flex-col items-center justify-center min-w-[20px]">
                                <span className={`text-[10px] sm:text-xs font-black ${
                                  songInList.upvoters?.includes(user.userId) ? (downvotesEnabled ? 'text-green-500' : 'text-red-500') : 
                                  songInList.downvoters?.includes(user.userId) ? 'text-red-500' : 'text-gray-500'
                                }`}>
                                  {songInList.votes > 0 ? `+${songInList.votes}` : songInList.votes}
                                </span>
                             </div>
                             <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                                {downvotesEnabled && (
                                  <button 
                                    onClick={() => voteSong(songInList.id, 'down')}
                                    className={`w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all active:scale-90 border ${
                                      songInList.downvoters?.includes(user.userId) 
                                      ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                                      : 'bg-transparent border-transparent text-gray-500 hover:text-white hover:bg-white/5'
                                    }`}
                                  >
                                    <ThumbsDown className="w-3 h-3" />
                                  </button>
                                )}
                                <button 
                                  onClick={() => voteSong(songInList.id, 'up')}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded flex items-center justify-center transition-all active:scale-90 border ${
                                    songInList.upvoters?.includes(user.userId) 
                                    ? (downvotesEnabled ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500') + ' text-white shadow-lg' 
                                    : 'bg-transparent border-transparent text-gray-500 hover:text-white hover:bg-white/5'
                                  }`}
                                >
                                  <ThumbsUp className="w-3 h-3" />
                                </button>
                             </div>
                          </div>
                        );
                      }
                      return (
                        <button 
                          onClick={() => addSong(track)}
                          className="p-2 rounded-full hover:bg-red-600 hover:text-white transition-all bg-white/5 sm:bg-transparent"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      );
                    })()}
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* Queue Section (Unified Wishlist and Queued) */}
        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-6">
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <Music className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />
              Warteschlange
            </h2>
            <div className="text-[10px] text-gray-500 uppercase tracking-widest font-semibold">{songs.filter(s => s.status !== 'played').length} Lieder</div>
          </div>

          <div className="space-y-3 sm:space-y-4">
            <AnimatePresence mode="popLayout">
              {songs.filter(s => s.status !== 'played').length === 0 ? (
                <motion.div 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-center py-12 sm:py-20 bg-white/5 rounded-2xl border border-dashed border-white/10"
                >
                  <Music className="w-10 h-10 sm:w-12 sm:h-12 text-gray-700 mx-auto mb-4" />
                  <p className="text-sm text-gray-500 px-4">Noch keine Lieder. Sei der Erste!</p>
                </motion.div>
              ) : (
                songs
                  .filter(s => s.status !== 'played')
                  .sort((a, b) => {
                    // 1. Songs already on Spotify (queued) always first
                    if (a.status === 'queued' && b.status !== 'queued') return -1;
                    if (a.status !== 'queued' && b.status === 'queued') return 1;
                    
                    // 2. Priority/Moderator songs come before regular requests
                    if (a.status === 'priority' && b.status !== 'priority') return -1;
                    if (a.status !== 'priority' && b.status === 'priority') return 1;

                    // 3. Within blocks, sort by votes
                    return b.votes - a.votes;
                  })
                  .map((song) => (
                  <motion.div
                    key={song.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className={`group relative flex items-center justify-between p-3 sm:p-4 rounded-xl border transition-all shadow-lg ${
                      song.status === 'queued' 
                        ? 'bg-red-600/5 border-red-600/20 ring-1 ring-red-600/10' 
                        : song.status === 'priority'
                        ? 'bg-white/5 border-red-600/20'
                        : 'bg-[#181818] hover:bg-[#202020] border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3 sm:gap-5 flex-1 min-w-0">
                      <div className="relative shrink-0">
                        <img src={song.albumArt} alt="" className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover shadow-2xl" />
                        {song.status === 'queued' && (
                          <div className="absolute inset-0 bg-red-600/20 rounded-lg flex items-center justify-center">
                             <PlayCircle className="w-6 h-6 text-white/80 animate-pulse" />
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-bold text-sm sm:text-base tracking-tight truncate">{song.title}</h3>
                          {song.status === 'queued' && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-red-600 text-white uppercase font-black tracking-widest flex-none">
                              Spielt bald
                            </span>
                          )}
                          {song.status === 'priority' && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-white/10 text-gray-400 uppercase font-black tracking-widest flex-none border border-white/10">
                              Warteschlange
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] sm:text-xs text-gray-500 font-medium truncate mb-1.5">{song.artist}</p>
                        
                        <div className="flex items-center gap-3">
                           <button 
                            onClick={() => setVoterModalSong(song)}
                            className="bg-white/5 hover:bg-white/10 px-2 py-1 rounded text-[9px] font-bold text-gray-400 uppercase tracking-wider transition-colors flex items-center gap-1.5"
                           >
                             <Users className="w-3 h-3" />
                             {song.requestedBy}
                           </button>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                      {isAdminMode && isAuthenticatedAdmin && (
                        <div className="flex items-center gap-2">
                           <button 
                              onClick={() => deleteSong(song.id)}
                              className="sm:opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-gray-500 hover:text-red-500 w-9 h-9 rounded-lg transition-all active:scale-95 shadow-lg"
                              title="Lied entfernen"
                           >
                              <Trash2 className="w-4 h-4" />
                           </button>
                           {(!song.status || song.status === 'requested') && (
                             <button 
                                onClick={() => queueSong(song.id)}
                                className="sm:opacity-0 group-hover:opacity-100 flex items-center justify-center bg-red-600 text-white w-9 h-9 sm:w-auto sm:px-3 sm:py-2 rounded-lg transition-all active:scale-95 shadow-lg shadow-red-600/20"
                             >
                                <ChevronUp className="w-5 h-5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline ml-1.5 text-xs font-bold uppercase tracking-wider">Prio</span>
                             </button>
                           )}
                        </div>
                      )}

                      <div className="flex items-center gap-3">
                        <button 
                          onClick={() => setVoterModalSong(song)}
                          className="flex flex-col items-center justify-center min-w-[24px] hover:bg-white/5 p-1 rounded-lg transition-colors group/voters"
                          title="Wähler anzeigen"
                        >
                          <span className={`text-xs sm:text-sm font-black transition-colors ${
                            song.upvoters?.includes(user?.userId || '') ? (downvotesEnabled ? 'text-green-500' : 'text-red-500') : 
                            song.downvoters?.includes(user?.userId || '') ? 'text-red-500' : 'text-gray-500'
                          }`}>
                            {song.votes > 0 ? `+${song.votes}` : song.votes}
                          </span>
                          <div className="flex items-center gap-1 opacity-40 group-hover/voters:opacity-100 transition-opacity">
                            <Users className="w-2.5 h-2.5" />
                          </div>
                        </button>

                        <div className="flex items-center gap-1 sm:gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
                          {downvotesEnabled && (
                            <button 
                              onClick={() => voteSong(song.id, 'down')}
                              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${
                                song.downvoters?.includes(user?.userId || '') 
                                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-600/20' 
                                : 'bg-transparent border-transparent text-gray-500 hover:text-white hover:bg-white/5'
                              }`}
                            >
                              <ThumbsDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${song.downvoters?.includes(user?.userId || '') ? 'fill-white' : ''}`} />
                            </button>
                          )}
                          <button 
                            onClick={() => voteSong(song.id, 'up')}
                            className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${
                              song.upvoters?.includes(user?.userId || '') 
                              ? (downvotesEnabled ? 'bg-green-600 border-green-500' : 'bg-red-600 border-red-500') + ' text-white shadow-lg' 
                              : 'bg-transparent border-transparent text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <ThumbsUp className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${song.upvoters?.includes(user?.userId || '') ? 'fill-white' : ''}`} />
                          </button>
                        </div>
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
                  Sitzungs-Statistiken
                </h2>
                <div className="flex items-center gap-3">
                  {isSpotifyConnected && (
                    <button 
                      onClick={disconnectSpotify}
                      className="text-[10px] uppercase tracking-wider font-bold py-1.5 px-3 bg-red-600/10 text-red-500 rounded-full border border-red-600/20 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2"
                    >
                      <LogOut className="w-3 h-3" />
                      Spotify trennen
                    </button>
                  )}
                  <button onClick={() => setIsAdminOpen(false)} className="text-gray-500 hover:text-white p-1">✕</button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-6">
                  <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2">
                    <Settings className="w-3.5 h-3.5" />
                    Einstellungen
                  </h3>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">Downvotes aktivieren</div>
                      <div className="text-[10px] text-gray-500">Ermöglicht es Nutzern, Lieder negativ zu bewerten.</div>
                    </div>
                    <button 
                      onClick={() => toggleDownvotes(!downvotesEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${downvotesEnabled ? 'bg-red-600' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${downvotesEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  <div className="h-px bg-white/5 my-4" />

                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-bold">Autoplay aktivieren</div>
                      <div className="text-[10px] text-gray-500">Spielt automatisch das am besten bewertete Lied, wenn keins läuft.</div>
                    </div>
                    <button 
                      onClick={() => toggleAutoplay(!autoplayEnabled)}
                      className={`relative w-12 h-6 rounded-full transition-colors ${autoplayEnabled ? 'bg-green-600' : 'bg-gray-700'}`}
                    >
                      <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoplayEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
                    </button>
                  </div>

                  {spotifyDebug && (
                    <div className="mt-6 pt-6 border-t border-white/5">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Spotify Debug (Konfiguration)
                      </h3>
                      <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5 text-[10px] sm:text-xs">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Client ID:</span>
                          <span className={spotifyDebug.hasClientId ? 'text-green-500' : 'text-red-500 font-bold'}>
                            {spotifyDebug.hasClientId ? `Vorhanden (${spotifyDebug.env.SPOTIFY_CLIENT_ID})` : 'FEHLT'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">Client Secret:</span>
                          <span className={spotifyDebug.hasClientSecret ? 'text-green-500' : 'text-red-500 font-bold'}>
                            {spotifyDebug.hasClientSecret ? 'Vorhanden' : 'FEHLT'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">APP_URL:</span>
                          <span className={spotifyDebug.hasAppUrl ? 'text-gray-300' : 'text-red-500 font-bold'}>
                            {spotifyDebug.env.APP_URL}
                          </span>
                        </div>
                        <div className="flex justify-between p-2 bg-white/5 rounded border border-white/5 mt-2">
                          <span className="text-gray-400 font-bold">Redirect URI:</span>
                          <span className="text-white font-mono break-all text-right ml-4">
                            {spotifyDebug.redirectUri}
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-600 mt-2 italic px-1">
                          * Diese URL muss exakt so im Spotify Dashboard eingestellt sein.
                        </div>
                        
                        <div className="h-px bg-white/5 my-2" />
                        
                        <div className="flex justify-between">
                          <span className="text-gray-500">Admin Verbunden:</span>
                          <span className={spotifyDebug.hasAdminToken ? 'text-green-500' : 'text-red-500 font-bold'}>
                            {spotifyDebug.hasAdminToken ? 'JA' : 'NEIN'}
                          </span>
                        </div>
                        {spotifyDebug.hasAdminToken && (
                          <>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Refresh Token:</span>
                              <span className={spotifyDebug.hasRefreshToken ? 'text-green-500' : 'text-red-500 font-bold'}>
                                {spotifyDebug.hasRefreshToken ? 'Vorhanden' : 'FEHLT (Neu einloggen!)'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Token Ablauf:</span>
                              <span className={spotifyDebug.isTokenExpired ? 'text-yellow-500' : 'text-gray-300'}>
                                {spotifyDebug.tokenExpiresAt} {spotifyDebug.isTokenExpired && '(Abgelaufen - wird autom. erneuert)'}
                              </span>
                            </div>
                          </>
                        )}
                        <button 
                          onClick={fetchSpotifyDebug}
                          className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-[10px] font-bold uppercase transition-colors"
                        >
                          Status aktualisieren
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Departments Manager */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 shadow-inner mb-10">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mb-6 flex items-center gap-2">
                    <Building2 className="w-4 h-4" />
                    Abteilungen verwalten
                  </h3>
                  
                  <div className="flex gap-3 mb-8">
                    <div className="relative flex-1">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
                      <input 
                        type="text" 
                        value={newDeptName}
                        onChange={e => setNewDeptName(e.target.value)}
                        placeholder="Neue Abteilung eingeben..."
                        onKeyDown={e => e.key === 'Enter' && addDepartment()}
                        className="w-full bg-black/40 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-sm outline-none focus:border-red-600/50 transition-all"
                      />
                    </div>
                    <button 
                      onClick={addDepartment}
                      className="bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 shadow-lg shadow-red-600/20"
                    >
                      Hinzufügen
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    {departments.map(dept => (
                      <motion.div 
                        key={dept} 
                        layout
                        className="flex items-center justify-between gap-2 bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 group hover:border-white/20 transition-all"
                      >
                        <span className="text-xs font-bold text-gray-300 truncate">{dept}</span>
                        <button 
                          onClick={() => removeDepartment(dept)}
                          className="text-gray-600 hover:text-red-500 transition-colors p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </motion.div>
                    ))}
                    {departments.length === 0 && (
                      <p className="col-span-full text-[10px] text-gray-600 italic py-4 text-center">Keine Abteilungen konfiguriert. "Sonstige" wird immer als Fallback angezeigt.</p>
                    )}
                  </div>
                </div>

                {/* Moderator Manager */}
                <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-10">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mb-6 flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Benutzerrechte (Moderatoren)
                  </h3>

                  <div className="space-y-3">
                    {adminUsers.map((u) => (
                      <div key={u.id} className="flex items-center justify-between bg-black/40 px-4 py-3 rounded-xl border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.isModerator ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}>
                            {u.username.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="text-sm font-bold">{u.username}</div>
                            <div className="text-[10px] text-gray-500 uppercase tracking-widest">{u.department}</div>
                          </div>
                        </div>
                        
                        {u.username.toLowerCase() === 'admin' && u.department.toLowerCase() === 'dev' ? (
                          <span className="text-[9px] font-black uppercase tracking-widest text-red-600 px-2 py-1 bg-red-600/10 rounded-lg">Master Admin</span>
                        ) : (
                          <button
                            onClick={() => toggleModerator(u.id, !u.isModerator)}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                              u.isModerator 
                                ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' 
                                : 'bg-white/5 text-gray-500 hover:text-white hover:bg-white/10'
                            }`}
                          >
                            {u.isModerator ? 'Moderator' : 'Zuweisen'}
                          </button>
                        )}
                      </div>
                    ))}
                    {adminUsers.length === 0 && (
                      <p className="text-[10px] text-gray-600 italic py-2 text-center">Keine Benutzer in der Datenbank.</p>
                    )}
                  </div>
                </div>

                <div className="space-y-8">
                  <section>
                    <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
                       <PlayCircle className="w-3 h-3" />
                       Aktuelle Wünsche ({adminStats.current.length})
                    </h3>
                    <div className="space-y-4">
                      {adminStats.current.length === 0 ? (
                        <p className="text-xs text-gray-600 italic">Keine aktiven Wünsche.</p>
                      ) : (
                        adminStats.current.map((song) => (
                          <div key={song.id} className="bg-white/5 rounded-2xl p-5 border border-white/5 hover:bg-white-[0.07] transition-colors">
                            <div className="flex justify-between items-start mb-4">
                              <div className="min-w-0 pr-4">
                                <h4 className="font-black text-base truncate">{song.title}</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1">
                                  <span className="truncate">{song.artist}</span>
                                  <span className="shrink-0 text-[10px] bg-white/10 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Anfrage: {song.requestedBy}</span>
                                  {song.status === 'queued' && <span className="shrink-0 text-[10px] bg-red-600/20 text-red-500 px-1.5 py-0.5 rounded uppercase font-black tracking-widest border border-red-600/20">Warteschlange</span>}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black shadow-lg shadow-red-600/20">
                                  {song.totalVotes} Score
                                </div>
                                <div className="text-[9px] font-bold text-gray-500 flex gap-2">
                                  <span className="text-green-500/80">+{song.upvotes} UP</span>
                                  {downvotesEnabled && <span className="text-red-500/80">-{song.downvotes} DOWN</span>}
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div>
                                <div className="flex items-center gap-2 mb-2">
                                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                                  <div className="text-[10px] font-black text-green-500 uppercase tracking-widest">Wähler (Up)</div>
                                </div>
                                <div className="flex flex-wrap gap-2 pr-4">
                                  {Object.entries(song.departmentsUp || {}).map(([dept, voters]) => (
                                    <div key={dept} className="bg-black/40 rounded-xl px-3 py-2 border border-white/5 text-[11px] group/dept hover:border-green-500/30 transition-colors">
                                      <span className="text-gray-500 font-bold uppercase text-[9px] mr-2 tracking-wider">{dept}</span>
                                      <span className="text-gray-200 font-medium">{(voters as string[]).join(', ')}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              {downvotesEnabled && Object.keys(song.departmentsDown || {}).length > 0 && (
                                <div className="pt-2 border-t border-white/5">
                                  <div className="flex items-center gap-2 mb-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                                    <div className="text-[10px] font-black text-red-500 uppercase tracking-widest">Wähler (Down)</div>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {Object.entries(song.departmentsDown || {}).map(([dept, voters]) => (
                                      <div key={dept} className="bg-black/40 rounded-xl px-3 py-2 border border-white/5 text-[11px] hover:border-red-500/30 transition-colors">
                                        <span className="text-gray-500 font-bold uppercase text-[9px] mr-2 tracking-wider">{dept}</span>
                                        <span className="text-gray-200 font-medium">{(voters as string[]).join(', ')}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </section>

                  {adminStats.history.length > 0 && (
                    <section className="pt-8 border-t border-white/10">
                      <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2">
                         <Music className="w-3 h-3" />
                         Verlauf ({adminStats.history.length})
                      </h3>
                      <div className="space-y-4">
                        {adminStats.history.slice(0, 10).map((song) => (
                          <div 
                            key={song.id} 
                            onClick={() => setVoterModalSong(song)}
                            className="bg-white/5 rounded-2xl p-5 border border-white/5 opacity-70 hover:opacity-100 transition-all hover:bg-white-[0.07] cursor-pointer group/history"
                          >
                            <div className="flex justify-between items-start mb-4">
                              <div className="min-w-0 pr-4">
                                <h4 className="font-bold text-sm truncate">{song.title}</h4>
                                <div className="text-[10px] text-gray-500 mt-0.5 truncate">{song.artist} • <span className="font-bold uppercase tracking-tight">Angefragt von {song.requestedBy}</span></div>
                              </div>
                              <div className="flex flex-col items-end gap-1 shrink-0">
                                <div className="bg-white/10 text-gray-400 px-2 py-0.5 rounded-md text-[10px] font-bold">
                                  {song.totalVotes} Score
                                </div>
                                <div className="text-[8px] font-bold text-gray-600 flex gap-1.5">
                                  <span className="text-green-500/50">+{song.upvotes}</span>
                                  {downvotesEnabled && <span className="text-red-500/50">-{song.downvotes}</span>}
                                </div>
                              </div>
                            </div>
                            
                            <div className="space-y-3">
                              {Object.keys(song.departmentsUp || {}).length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(song.departmentsUp || {}).map(([dept, voters]) => (
                                    <div key={dept} className="text-[9px] text-gray-400 bg-black/20 px-2 py-1 rounded-lg border border-white/5">
                                      <span className="font-black text-green-500/50 mr-1">{dept}</span> {(voters as string[]).join(', ')}
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {downvotesEnabled && Object.keys(song.departmentsDown || {}).length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
                                  {Object.entries(song.departmentsDown || {}).map(([dept, voters]) => (
                                    <div key={dept} className="text-[9px] text-gray-400 bg-black/20 px-2 py-1 rounded-lg border border-white/5">
                                      <span className="font-black text-red-500/50 mr-1">{dept}</span> {(voters as string[]).join(', ')}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {adminStats.history.length > 10 && (
                           <p className="text-center text-[10px] text-gray-600 font-medium">Und {adminStats.history.length - 10} weitere Titel im Verlauf...</p>
                        )}
                      </div>
                    </section>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* PIN Prompt Modal */}
        <AnimatePresence>
          {showPinPrompt && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="w-full max-w-sm bg-[#181818] rounded-3xl p-8 border border-white/10 shadow-2xl relative"
              >
                <button 
                  onClick={() => setShowPinPrompt(false)}
                  className="absolute top-4 right-4 text-gray-500 hover:text-white"
                >
                  <XCircle className="w-6 h-6" />
                </button>
                
                <div className="flex flex-col items-center mb-6">
                  <div className="w-12 h-12 bg-red-600/20 rounded-full flex items-center justify-center mb-4">
                    <Settings className="w-6 h-6 text-red-600" />
                  </div>
                  <h2 className="text-xl font-bold">Admin Zugang</h2>
                  <p className="text-gray-500 text-xs mt-1">Bitte PIN eingeben</p>
                </div>

                <form onSubmit={verifyPin} className="space-y-4">
                  <input 
                    autoFocus
                    type="password" 
                    value={pinInput}
                    onChange={e => setPinInput(e.target.value)}
                    placeholder="PIN"
                    className="w-full bg-[#242424] border border-white/5 focus:border-red-600/50 rounded-xl py-4 text-center text-2xl font-black tracking-[0.5em] outline-none transition-all"
                  />
                  <button 
                    type="submit"
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all"
                  >
                    Bestätigen
                  </button>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

      {/* Voter Details Modal */}
      <AnimatePresence>
        {voterModalSong && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setVoterModalSong(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#1c1c1c] w-full max-w-md rounded-[32px] border border-white/10 shadow-2xl overflow-hidden relative z-10 flex flex-col max-h-[85vh]"
            >
              <div className="p-8 border-b border-white/10 bg-gradient-to-br from-white/10 to-transparent">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl font-black tracking-tight">{voterModalSong.title}</h3>
                  <button 
                    onClick={() => setVoterModalSong(null)} 
                    className="p-2 hover:bg-white/10 rounded-full transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-gray-500" />
                  </button>
                </div>
                <p className="text-gray-400 text-base font-medium">{voterModalSong.artist}</p>
                
                <div className="mt-6 flex items-center gap-4">
                   <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Stimmen</span>
                      <span className="text-3xl font-black text-white">{voterModalSong.votes > 0 ? `+${voterModalSong.votes}` : voterModalSong.votes}</span>
                   </div>
                   <div className="h-10 w-px bg-white/10" />
                   <div className="flex flex-col">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Anfrage</span>
                      <span className="text-sm font-bold text-gray-300">{voterModalSong.requestedBy || 'Spotify'}</span>
                   </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                {/* Upvotes */}
                <section>
                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center">
                      <ThumbsUp className="w-3 h-3 text-green-500" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-green-500">Upvotes ({voterModalSong.voters?.up.length || 0})</span>
                  </div>
                  
                  {Object.entries(groupVotersByDept(voterModalSong.voters?.up || [])).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(groupVotersByDept(voterModalSong.voters?.up || [])).map(([dept, names], idx) => (
                        <div key={idx} className="relative pl-4 border-l-2 border-green-500/20">
                          <span className="text-[10px] font-black uppercase text-gray-500 mb-3 block tracking-wider">{dept}</span>
                          <div className="flex flex-wrap gap-2">
                            {names.map((name, i) => (
                              <motion.span 
                                key={i}
                                initial={{ opacity: 0, scale: 0.8 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.05 }}
                                className="px-3.5 py-1.5 bg-white/5 text-gray-200 text-sm rounded-xl border border-white/5 font-semibold hover:border-green-500/30 transition-colors"
                              >
                                {name}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-4 px-6 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
                       <p className="text-gray-600 text-xs font-medium">Keine Upvotes für diesen Titel.</p>
                    </div>
                  )}
                </section>

                {/* Downvotes */}
                {downvotesEnabled && (
                  <section className="pt-4 mt-8 border-t border-white/5">
                    <div className="flex items-center gap-2 mb-5">
                      <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                        <ThumbsDown className="w-3 h-3 text-red-500" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">Downvotes ({voterModalSong.voters?.down.length || 0})</span>
                    </div>

                    {Object.entries(groupVotersByDept(voterModalSong.voters?.down || [])).length > 0 ? (
                      <div className="space-y-6">
                        {Object.entries(groupVotersByDept(voterModalSong.voters?.down || [])).map(([dept, names], idx) => (
                          <div key={idx} className="relative pl-4 border-l-2 border-red-500/20">
                            <span className="text-[10px] font-black uppercase text-gray-500 mb-3 block tracking-wider">{dept}</span>
                            <div className="flex flex-wrap gap-2">
                              {names.map((name, i) => (
                                <motion.span 
                                  key={i}
                                  initial={{ opacity: 0, scale: 0.8 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: i * 0.05 }}
                                  className="px-3.5 py-1.5 bg-white/5 text-gray-200 text-sm rounded-xl border border-white/5 font-semibold hover:border-red-500/30 transition-colors"
                                >
                                  {name}
                                </motion.span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-4 px-6 bg-white/5 rounded-2xl border border-dashed border-white/10 text-center">
                         <p className="text-gray-600 text-xs font-medium">Keine Downvotes für diesen Titel.</p>
                      </div>
                    )}
                  </section>
                )}
              </div>
              
              <div className="p-6 bg-black/20">
                <button 
                  onClick={() => setVoterModalSong(null)}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold transition-all active:scale-[0.98] shadow-xl shadow-red-600/20"
                >
                  Schließen
                </button>
              </div>
            </motion.div>
          </div>
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

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Users, LogOut, Settings, AlertCircle, Building2, Trash2, PlayCircle, Music } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isSpotifyConnected: boolean;
  onConnectSpotify: () => void;
  onDisconnectSpotify: () => void;
  downvotesEnabled: boolean;
  onToggleDownvotes: (val: boolean) => void;
  autoplayEnabled: boolean;
  onToggleAutoplay: (val: boolean) => void;
  spotifyDebug: any;
  onRefreshDebug: () => void;
  showDebug: boolean;
  onToggleDebug: () => void;
  departments: string[];
  newDeptName: string;
  setNewDeptName: (val: string) => void;
  onAddDept: () => void;
  onRemoveDept: (name: string) => void;
  adminUsers: any[];
  onToggleModerator: (userId: string, enabled: boolean) => void;
  adminStats: { current: any[]; history: any[] };
  onShowVoters: (song: any) => void;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen, onClose, isSpotifyConnected, onConnectSpotify, onDisconnectSpotify,
  downvotesEnabled, onToggleDownvotes, autoplayEnabled, onToggleAutoplay,
  spotifyDebug, onRefreshDebug, showDebug, onToggleDebug, departments, newDeptName, setNewDeptName,
  onAddDept, onRemoveDept, adminUsers, onToggleModerator, adminStats, onShowVoters
}) => {
  if (!isOpen) return null;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#181818] border border-white/10 w-full max-w-2xl max-h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        <div className="p-6 border-b border-white/5 flex items-center justify-between bg-[#202020]">
          <h2 className="text-xl font-bold flex items-center gap-3"><Users className="w-6 h-6 text-red-600" />Sitzungs-Statistiken</h2>
          <div className="flex items-center gap-3">
            {isSpotifyConnected ? (
              <button onClick={onDisconnectSpotify} className="text-[10px] uppercase tracking-wider font-bold py-1.5 px-3 bg-red-600/10 text-red-500 rounded-full border border-red-600/20 hover:bg-red-600 hover:text-white transition-all flex items-center gap-2">
                <LogOut className="w-3 h-3" />Spotify trennen
              </button>
            ) : (
                <button onClick={onConnectSpotify} className="text-[10px] uppercase tracking-wider font-bold py-1.5 px-3 bg-white/5 text-gray-400 rounded-full border border-white/10 hover:bg-white/10 transition-all">
                    Spotify verbinden
                </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1">✕</button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Settings Section */}
          <div className="bg-white/5 rounded-2xl p-5 border border-white/5 mb-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-4 flex items-center gap-2"><Settings className="w-3.5 h-3.5" />Einstellungen</h3>
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-bold">Downvotes aktivieren</div><div className="text-[10px] text-gray-500">Ermöglicht es Nutzern, Lieder negativ zu bewerten.</div></div>
              <button onClick={() => onToggleDownvotes(!downvotesEnabled)} className={`relative w-12 h-6 rounded-full transition-colors ${downvotesEnabled ? 'bg-red-600' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${downvotesEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="h-px bg-white/5 my-4" />
            <div className="flex items-center justify-between">
              <div><div className="text-sm font-bold">Autoplay aktivieren</div><div className="text-[10px] text-gray-500">Spielt automatisch das am besten bewertete Lied, wenn keins läuft.</div></div>
              <button onClick={() => onToggleAutoplay(!autoplayEnabled)} className={`relative w-12 h-6 rounded-full transition-colors ${autoplayEnabled ? 'bg-green-600' : 'bg-gray-700'}`}>
                <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${autoplayEnabled ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>

            {spotifyDebug && (
              <div className="mt-6 pt-6 border-t border-white/5">
                <button 
                  onClick={onToggleDebug}
                  className="w-full flex items-center justify-between text-xs font-bold uppercase tracking-widest text-red-500 mb-4 group"
                >
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Spotify Debug (Konfiguration)
                  </span>
                  <motion.span animate={{ rotate: showDebug ? 180 : 0 }} className="text-gray-500 group-hover:text-white transition-colors">
                    ▼
                  </motion.span>
                </button>
                
                <AnimatePresence>
                  {showDebug && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
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
                        {!spotifyDebug.hasAppUrl && (
                          <div className="text-[9px] text-gray-400 -mt-2 px-1">
                            (Optional, da REDIRECT_URI manuell gesetzt ist)
                          </div>
                        )}
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
                        <div className="flex gap-2 mt-4">
                          <button 
                            onClick={onRefreshDebug}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 text-[10px] font-bold uppercase transition-colors"
                          >
                            Status aktualisieren
                          </button>
                          {spotifyDebug.hasAdminToken && (
                            <button 
                              onClick={onDisconnectSpotify}
                              className="flex-1 py-3 bg-red-600/10 hover:bg-red-600 text-red-500 hover:text-white rounded-xl border border-red-600/20 text-[10px] font-bold uppercase transition-all"
                            >
                              Verbindung trennen
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>

          {/* Departments Section */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mb-6 flex items-center gap-2"><Building2 className="w-4 h-4" />Abteilungen verwalten</h3>
            <div className="flex gap-3 mb-8">
              <input type="text" value={newDeptName} onChange={e => setNewDeptName(e.target.value)} placeholder="Neue Abteilung..." className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-red-600/50" />
              <button onClick={onAddDept} className="bg-red-600 text-white px-6 py-3 rounded-xl text-sm font-black uppercase">Hinzufügen</button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {departments.map(dept => (
                <div key={dept} className="flex items-center justify-between bg-white/5 px-4 py-2.5 rounded-xl border border-white/5 group transition-all">
                  <span className="text-xs font-bold text-gray-300 truncate">{dept}</span>
                  <button onClick={() => onRemoveDept(dept)} className="text-gray-600 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          {/* Users Section */}
          <div className="bg-white/5 rounded-2xl p-6 border border-white/10 mb-10">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-red-600 mb-6 flex items-center gap-2"><Users className="w-4 h-4" />Benutzerrechte</h3>
            <div className="space-y-3">
              {adminUsers.map((u) => (
                <div key={u.id} className="flex items-center justify-between bg-black/40 px-4 py-3 rounded-xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${u.isModerator ? 'bg-red-600 text-white' : 'bg-white/10 text-gray-400'}`}>{u.username.substring(0, 2).toUpperCase()}</div>
                    <div className="text-sm font-bold">{u.username} <span className="text-[10px] text-gray-500">({u.department})</span></div>
                  </div>
                  <button onClick={() => onToggleModerator(u.id, !u.isModerator)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest ${u.isModerator ? 'bg-red-600 text-white' : 'bg-white/5 text-gray-500'}`}>{u.isModerator ? 'Moderator' : 'Zuweisen'}</button>
                </div>
              ))}
            </div>
          </div>

          {/* Stats Section */}
          <section className="space-y-6">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600 mb-4 flex items-center gap-2">
                <PlayCircle className="w-3 h-3" />Aktuelle Warteschlange ({adminStats.current.length})
              </h3>
              <div className="space-y-3">
                {adminStats.current.length > 0 ? adminStats.current.map((song) => (
                  <div key={song.id} className="bg-black/40 rounded-2xl p-4 border border-white/5 flex justify-between items-center group">
                    <div className="min-w-0 flex-1">
                      <h4 className="font-bold text-sm truncate">{song.title}</h4>
                      <div className="text-[10px] text-gray-400 truncate">{song.artist} • <span className="text-gray-500">Von {song.requester.username} ({song.requester.department})</span></div>
                    </div>
                    <div className="flex items-center gap-3 ml-4">
                      <button 
                        onClick={() => onShowVoters(song)}
                        className="p-2 text-gray-600 hover:text-white transition-colors"
                        title="Voter anzeigen"
                      >
                        <Users className="w-3.5 h-3.5" />
                      </button>
                      <div className="text-right">
                        <div className="text-xs font-black text-white">{song.totalVotes} Score</div>
                        <div className="text-[8px] text-gray-500 uppercase font-bold">↑{song.upvotes} ↓{song.downvotes}</div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 bg-black/20 rounded-2xl border border-dashed border-white/5 text-gray-600 text-xs font-medium">Keine aktiven Lieder in der Liste</div>
                )}
              </div>
            </div>

            {adminStats.history && adminStats.history.length > 0 && (
              <div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-4 flex items-center gap-2">
                  <Music className="w-3 h-3" />Historie (Gesamte Sitzung: {adminStats.history.length})
                </h3>
                <div className="space-y-3 opacity-80 hover:opacity-100 transition-opacity">
                  {adminStats.history.slice(0, 15).map((song) => (
                    <div 
                      key={song.id} 
                      className="bg-black/20 rounded-xl p-3 border border-white/5 flex justify-between items-center text-[10px] cursor-pointer hover:bg-white/5 transition-colors group"
                      onClick={() => onShowVoters(song)}
                    >
                       <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold truncate">{song.title}</h4>
                          <Users className="w-2.5 h-2.5 text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-gray-500 truncate">{song.artist} • <span className="text-gray-400">Von {song.requester.username}</span></div>
                      </div>
                      <div className="ml-4 text-right">
                        <div className="text-gray-300 font-bold">{song.totalVotes} Score</div>
                        <div className="text-[8px] text-gray-600 uppercase font-bold">↑{song.upvotes} ↓{song.downvotes}</div>
                      </div>
                    </div>
                  ))}
                  {adminStats.history.length > 15 && (
                    <div className="text-center text-[9px] text-gray-600 font-bold uppercase tracking-widest pt-2">
                      + {adminStats.history.length - 15} weitere Titel in der Historie
                    </div>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
};

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
  spotifyDebug, onRefreshDebug, departments, newDeptName, setNewDeptName,
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
                <h3 className="text-xs font-bold uppercase tracking-widest text-red-500 mb-4 flex items-center gap-2"><AlertCircle className="w-3.5 h-3.5" />Spotify Debug (Konfiguration)</h3>
                <div className="space-y-3 bg-black/20 p-4 rounded-xl border border-white/5 text-[10px] sm:text-xs">
                  <div className="flex justify-between"><span className="text-gray-500">Redirect URI:</span><span className="text-white font-mono">{spotifyDebug.redirectUri}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Admin Verbunden:</span><span className={spotifyDebug.hasAdminToken ? 'text-green-500' : 'text-red-500'}>{spotifyDebug.hasAdminToken ? 'JA' : 'NEIN'}</span></div>
                  <button onClick={onRefreshDebug} className="w-full mt-2 py-2 bg-white/5 hover:bg-white/10 rounded border border-white/5 text-[10px] font-bold uppercase">Status aktualisieren</button>
                </div>
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
          <section>
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-6 flex items-center gap-2"><PlayCircle className="w-3 h-3" />Aktuelle Wünsche</h3>
            <div className="space-y-4">
              {adminStats.current.map((song) => (
                <div key={song.id} className="bg-white/5 rounded-2xl p-5 border border-white/5">
                  <div className="flex justify-between items-start mb-4">
                    <div><h4 className="font-black text-base">{song.title}</h4><div className="text-xs text-gray-400">{song.artist} • {song.requestedBy}</div></div>
                    <div className="bg-red-600 text-white px-3 py-1 rounded-full text-[10px] font-black">{song.totalVotes} Score</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
};

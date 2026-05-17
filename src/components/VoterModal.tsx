import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { XCircle, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Song } from '../types.js';

interface VoterModalProps {
  song: Song | any | null;
  onClose: () => void;
  downvotesEnabled: boolean;
}

export const VoterModal: React.FC<VoterModalProps> = ({ song, onClose, downvotesEnabled }) => {
  if (!song) return null;

  const groupVotersByDept = (voters: { username: string; department: string }[]) => {
    return voters.reduce((acc, v) => {
      const dept = v.department || 'Sonstige';
      if (!acc[dept]) acc[dept] = [];
      acc[dept].push(v.username);
      return acc;
    }, {} as Record<string, string[]>);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
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
            <h3 className="text-2xl font-black tracking-tight">{song.title}</h3>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
              <XCircle className="w-6 h-6 text-gray-500" />
            </button>
          </div>
          <p className="text-gray-400 text-base font-medium">{song.artist}</p>
          <div className="mt-6 flex items-center gap-4">
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Stimmen</span>
                <span className="text-3xl font-black text-white">{song.votes > 0 ? `+${song.votes}` : song.votes}</span>
             </div>
             <div className="h-10 w-px bg-white/10" />
             <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Anfrage</span>
                <span className="text-sm font-bold text-gray-300">{song.requestedBy || 'Spotify'}</span>
             </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <section>
            <div className="flex items-center gap-2 mb-5">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center ${downvotesEnabled ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                <ThumbsUp className={`w-3 h-3 ${downvotesEnabled ? 'text-green-500' : 'text-red-500'}`} />
              </div>
              <span className={`text-xs font-bold uppercase tracking-[0.2em] ${downvotesEnabled ? 'text-green-500' : 'text-red-500'}`}>Upvotes ({song.voters?.up.length || 0})</span>
            </div>
            {Object.entries(groupVotersByDept(song.voters?.up || [])).length > 0 ? (
              <div className="space-y-6">
                {Object.entries(groupVotersByDept(song.voters?.up || [])).map(([dept, names], idx) => (
                  <div key={idx} className={`relative pl-4 border-l-2 ${downvotesEnabled ? 'border-green-500/20' : 'border-red-500/20'}`}>
                    <span className="text-[10px] font-black uppercase text-gray-500 mb-3 block tracking-wider">{dept}</span>
                    <div className="flex flex-wrap gap-2">
                      {names.map((name, i) => (
                        <motion.span 
                          key={i}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                          className={`px-3.5 py-1.5 bg-white/5 text-gray-200 text-sm rounded-xl border border-white/5 font-semibold transition-colors ${downvotesEnabled ? 'hover:border-green-500/30' : 'hover:border-red-500/30'}`}
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

          {downvotesEnabled && (
            <section className="pt-4 mt-8 border-t border-white/5">
              <div className="flex items-center gap-2 mb-5">
                <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                  <ThumbsDown className="w-3 h-3 text-red-500" />
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.2em] text-red-500">Downvotes ({song.voters?.down.length || 0})</span>
              </div>
              {Object.entries(groupVotersByDept(song.voters?.down || [])).length > 0 ? (
                <div className="space-y-6">
                  {Object.entries(groupVotersByDept(song.voters?.down || [])).map(([dept, names], idx) => (
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
          <button onClick={onClose} className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-bold">Schließen</button>
        </div>
      </motion.div>
    </div>
  );
};

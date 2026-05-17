import React from 'react';
import { motion } from 'motion/react';
import { PlayCircle, Trash2, ChevronUp, Users, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Song, UserProfile } from '../types.js';

interface SongCardProps {
  song: Song;
  user: UserProfile | null;
  isAdminMode: boolean;
  isAuthenticatedAdmin: boolean;
  downvotesEnabled: boolean;
  onVote: (songId: string, type: 'up' | 'down') => void;
  onDelete: (songId: string) => void;
  onQueue: (songId: string) => void;
  onShowVoters: (song: Song) => void;
}

export const SongCard: React.FC<SongCardProps> = ({
  song,
  user,
  isAdminMode,
  isAuthenticatedAdmin,
  downvotesEnabled,
  onVote,
  onDelete,
  onQueue,
  onShowVoters
}) => {
  return (
    <motion.div
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
              onClick={() => onShowVoters(song)}
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
                onClick={() => onDelete(song.id)}
                className="sm:opacity-0 group-hover:opacity-100 flex items-center justify-center bg-white/5 border border-white/10 hover:border-red-500/50 hover:bg-red-500/10 text-gray-500 hover:text-red-500 w-9 h-9 rounded-lg transition-all active:scale-95 shadow-lg"
                title="Lied entfernen"
             >
                <Trash2 className="w-4 h-4" />
             </button>
             {(!song.status || song.status === 'requested') && (
               <button 
                  onClick={() => onQueue(song.id)}
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
            onClick={() => onShowVoters(song)}
            className="flex flex-col items-center justify-center min-w-[24px] hover:bg-white/5 p-1 rounded-lg transition-colors group/voters"
            title="Wähler anzeigen"
          >
            <span className={`text-xs sm:text-sm font-black transition-colors ${
              song.upvoters?.includes(user?.userId || '') 
                ? (downvotesEnabled ? 'text-green-500' : 'text-red-500') : 
              song.downvoters?.includes(user?.userId || '') 
                ? 'text-red-500' : 'text-gray-500'
            }`}>
              {song.votes > 0 ? `+${song.votes}` : song.votes}
            </span>
            <div className="flex items-center gap-1 opacity-40 group-hover/voters:opacity-100 transition-opacity">
              <Users className="w-2.5 h-2.5" />
            </div>
          </button>

          <div className="flex items-center gap-1.5 sm:gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
            {downvotesEnabled && (
              <button 
                onClick={() => onVote(song.id, 'down')}
                className={`w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center transition-all active:scale-90 border ${
                  song.downvoters?.includes(user?.userId || '') 
                  ? 'bg-red-600 border-red-500 text-white shadow-lg' 
                  : 'bg-transparent border-transparent text-gray-500 hover:text-white hover:bg-white/5'
                }`}
              >
                <ThumbsDown className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${song.downvoters?.includes(user?.userId || '') ? 'fill-white' : ''}`} />
              </button>
            )}
            <button 
              onClick={() => onVote(song.id, 'up')}
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
  );
};

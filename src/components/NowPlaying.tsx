import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { PlayCircle, Users, ThumbsUp } from 'lucide-react';
import { PlaybackState, Song } from '../types.js';

interface NowPlayingProps {
  playback: PlaybackState | null;
  onShowVoters: (song: any) => void;
  downvotesEnabled: boolean;
}

export const NowPlaying: React.FC<NowPlayingProps> = ({ playback, onShowVoters, downvotesEnabled }) => {
  if (!playback) return (
    <div className="mb-10 sm:mb-14 overflow-hidden h-32 sm:h-44 bg-white/5 rounded-3xl border border-dashed border-white/10 flex items-center justify-center text-gray-600 text-sm italic">
        Keine Wiedergabe aktiv
    </div>
  );

  return (
    <motion.section 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="mb-10 sm:mb-14 overflow-hidden"
    >
      <div className="bg-[#181818] rounded-3xl border border-white/10 shadow-2xl relative overflow-hidden group">
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/5" />
        <motion.div 
           className="absolute bottom-0 left-0 h-1 bg-red-600 shadow-[0_0_10px_#e30613]"
           initial={false}
           animate={{ width: `${(playback.progress_ms / playback.item.duration_ms) * 100}%` }}
           transition={{ duration: 0.5, ease: "linear" }}
        />
        <div className="p-5 sm:p-8 flex flex-col sm:flex-row items-center gap-6 sm:gap-8">
          <div className="relative group shrink-0">
            <div className="absolute inset-0 bg-red-600/20 blur-2xl rounded-full scale-150 opacity-50 group-hover:opacity-80 transition-opacity" />
            <img src={playback.item.albumArt} alt="" className="w-32 h-32 sm:w-44 sm:h-44 rounded-2xl object-cover shadow-[0_20px_50px_rgba(0,0,0,0.5)] relative z-10 border border-white/5" />
            {playback.is_playing && (
              <div className="absolute -bottom-2 -right-2 z-20 bg-red-600 p-2 rounded-full shadow-lg border-2 border-[#181818]">
                <PlayCircle className="w-6 h-6 text-white animate-pulse" />
              </div>
            )}
          </div>
          <div className="flex-1 text-center sm:text-left relative z-10">
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
               <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-red-500 animate-pulse">Now Playing</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-black mb-2 tracking-tight line-clamp-1">{playback.item.name}</h2>
            <p className="text-base sm:text-xl text-gray-400 font-medium mb-4">{playback.item.artists.join(', ')}</p>
            {playback.voterInfo && (
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onShowVoters({ title: playback.item.name, artist: playback.item.artists.join(', '), voters: playback.voterInfo?.voters, votes: playback.voterInfo?.votes, requestedBy: playback.voterInfo?.requestedBy })}
                className="inline-flex items-center justify-center sm:justify-start gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-2 pr-3 border-r border-white/10">
                   <div className={`w-8 h-8 rounded-full flex items-center justify-center ${downvotesEnabled ? 'bg-green-600/10' : 'bg-red-600/10'}`}>
                     <ThumbsUp className={`w-4 h-4 ${downvotesEnabled ? 'text-green-600' : 'text-red-600'}`} />
                   </div>
                   <span className="text-lg font-black text-white">{playback.voterInfo.votes}</span>
                </div>
                <div className="flex items-center gap-1"><span className="text-xs text-gray-500 font-medium">Ansehen</span><Users className="w-3 h-3 text-gray-600" /></div>
              </motion.button>
            )}
          </div>
        </div>
      </div>
    </motion.section>
  );
};

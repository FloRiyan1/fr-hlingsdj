import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Plus, Loader2, ThumbsUp, ThumbsDown, XCircle } from 'lucide-react';
import { SpotifyTrack, Song, UserProfile } from '../types.js';

interface SearchSectionProps {
  searchRef?: React.RefObject<HTMLDivElement>;
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  onSearch: () => void;
  isSearching: boolean;
  searchResults: SpotifyTrack[];
  onAddSong: (track: SpotifyTrack) => void;
  onVote: (songId: string, type: 'up' | 'down') => void;
  songs: Song[];
  user: UserProfile | null;
  downvotesEnabled: boolean;
  onClear?: () => void;
}

export const SearchSection: React.FC<SearchSectionProps> = ({
  searchRef, searchQuery, setSearchQuery, onSearch, isSearching, searchResults,
  onAddSong, onVote, songs, user, downvotesEnabled, onClear
}) => {
  return (
    <section ref={searchRef} className="mb-8 sm:mb-12">
      <h2 className="text-base sm:text-lg font-bold mb-3 sm:mb-4 flex items-center gap-2"><Plus className="w-4 h-4 sm:w-5 sm:h-5 text-red-600" />Lied anfragen</h2>
      <div className="relative mb-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" placeholder="Lied oder Interpret suchen..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && onSearch()}
            className="w-full bg-[#1e1e1e] border border-white/5 focus:border-red-600/30 rounded-2xl py-4 pl-11 pr-24 outline-none transition-all placeholder:text-gray-600 shadow-xl text-sm sm:text-base"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            {searchQuery && (
              <button 
                onClick={onClear}
                className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
                title="Suche leeren"
              >
                <XCircle className="w-4 h-4" />
              </button>
            )}
            <button onClick={onSearch} disabled={isSearching || !searchQuery} className="w-10 h-10 bg-red-600 text-white rounded-xl hover:bg-red-700 disabled:opacity-30 flex items-center justify-center">
              {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="bg-[#1e1e1e] rounded-xl border border-white/10 overflow-hidden mb-8 shadow-2xl relative z-40">
            {searchResults.map((track) => {
              const songInList = songs.find(s => s.spotifyUri === track.uri);
              return (
                <div key={track.id} className="flex items-center justify-between p-3 sm:p-4 hover:bg-white/5 border-b border-white/5 last:border-0">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <img src={track.album.images[0]?.url} alt="" className="w-10 h-10 rounded shadow-lg" />
                    <div className="min-w-0"><div className="font-bold text-xs sm:text-sm line-clamp-1">{track.name}</div><div className="text-[10px] sm:text-xs text-gray-400 truncate">{track.artists.map(a => a.name).join(', ')}</div></div>
                  </div>
                   {songInList ? (
                    <div className="flex items-center gap-2">
                       <span className={`text-[10px] sm:text-xs font-black ${
                         songInList.upvoters?.includes(user?.userId || '') 
                          ? (downvotesEnabled ? 'text-green-500' : 'text-red-500') 
                          : songInList.downvoters?.includes(user?.userId || '') ? 'text-red-500' : 'text-gray-500'
                       }`}>
                         {songInList.votes > 0 ? `+${songInList.votes}` : songInList.votes}
                       </span>
                       <div className="flex items-center gap-1 bg-white/5 p-1 rounded-lg border border-white/10">
                          {downvotesEnabled && (
                            <button 
                              onClick={() => onVote(songInList.id, 'down')} 
                              className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${songInList.downvoters?.includes(user?.userId || '') ? 'bg-red-600 text-white' : 'text-gray-500 hover:text-white'}`}
                            >
                              <ThumbsDown className={`w-3 h-3 ${songInList.downvoters?.includes(user?.userId || '') ? 'fill-white' : ''}`} />
                            </button>
                          )}
                          <button 
                            onClick={() => onVote(songInList.id, 'up')} 
                            className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                              songInList.upvoters?.includes(user?.userId || '') 
                                ? (downvotesEnabled ? 'bg-green-600' : 'bg-red-600') + ' text-white' 
                                : 'text-gray-500 hover:text-white'
                            }`}
                          >
                            <ThumbsUp className={`w-3 h-3 ${songInList.upvoters?.includes(user?.userId || '') ? 'fill-white' : ''}`} />
                          </button>
                       </div>
                    </div>
                  ) : (
                    <button onClick={() => onAddSong(track)} className="p-2 rounded-full hover:bg-red-600 hover:text-white transition-all bg-white/5"><Plus className="w-5 h-5" /></button>
                  )}
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

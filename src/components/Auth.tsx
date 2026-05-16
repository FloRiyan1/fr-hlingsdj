import React from 'react';
import { motion } from 'motion/react';
import { Music, User, Building2, ChevronUp, LogIn, AlertCircle } from 'lucide-react';

interface AuthProps {
  username: string;
  setUsername: (val: string) => void;
  department: string;
  setDepartment: (val: string) => void;
  departments: string[];
  onLogin: (e: React.FormEvent) => void;
  error: string | null;
}

export const Auth: React.FC<AuthProps> = ({
  username, setUsername, department, setDepartment, departments, onLogin, error
}) => {
  return (
    <div className="min-h-screen bg-[#121212] text-white flex items-center justify-center p-6 font-sans">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md bg-[#181818] rounded-2xl p-8 border border-white/10 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-lg flex items-center justify-center mb-4 shadow-[0_0_20px_rgba(227,6,19,0.3)]"><Music className="w-8 h-8 text-white font-bold" /></div>
          <h1 className="text-3xl font-bold tracking-tight">pds <span className="font-light">Frühlingsmix</span></h1>
          <p className="text-gray-400 mt-2 text-center text-sm">Willkommen! Bitte melde dich an, um Lieder zu wünschen.</p>
        </div>
        <form onSubmit={onLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 px-1">Name</label>
            <div className="relative"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="Dein Name" className="w-full bg-[#242424] border border-transparent focus:border-red-600/50 rounded-lg py-3 pl-10 pr-4 outline-none transition-all placeholder:text-gray-600" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2 px-1">Abteilung</label>
            <div className="relative"><Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 z-10" />
              <select value={department} onChange={e => setDepartment(e.target.value)} className="w-full bg-[#242424] border border-transparent focus:border-red-600/50 rounded-lg py-3 pl-10 pr-4 outline-none transition-all text-white appearance-none cursor-pointer" required>
                <option value="" disabled>Wähle deine Abteilung</option>
                {departments.map(dept => (<option key={dept} value={dept}>{dept}</option>))}
                <option value="Sonstige">Sonstige</option>
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"><ChevronUp className="w-4 h-4 text-gray-500 rotate-180" /></div>
            </div>
          </div>
          <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-red-600/10"><LogIn className="w-4 h-4" />Anmelden</button>
        </form>
        {error && <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2 text-red-400 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      </motion.div>
    </div>
  );
};

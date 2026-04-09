import React from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';

const MaintenancePage = () => {
  return (
    <div className="min-h-[100dvh] bg-cream flex flex-col items-center justify-center p-6 text-center overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="neo-card p-12 bg-white/80 backdrop-blur-xl border-white/40 space-y-6 max-w-md w-full"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
          className="text-6xl"
        >
          🎈
        </motion.div>
        <h1 className="text-3xl font-black text-dark tracking-tight">THANKS FOR PLAYING!</h1>
        <p className="text-muted font-bold uppercase tracking-widest text-sm">
          App is under maintenance.
        </p>
        <div className="flex items-center justify-center gap-2 text-rust">
          <Sparkles className="animate-pulse" />
          <span className="text-xs font-black uppercase tracking-widest">Coming Soon</span>
        </div>
      </motion.div>
    </div>
  );
};

export default MaintenancePage;

"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Compass } from 'lucide-react';
import { sounds } from '@/lib/sounds';

interface FreeMoveIndicatorProps {
  isFreeMove: boolean;
  activeBoard: number | null;
}

const BOARD_NAMES = [
  'TOP-LEFT', 'TOP-CENTER', 'TOP-RIGHT',
  'MIDDLE-LEFT', 'CENTER', 'MIDDLE-RIGHT',
  'BOTTOM-LEFT', 'BOTTOM-CENTER', 'BOTTOM-RIGHT'
];

export const FreeMoveIndicator: React.FC<FreeMoveIndicatorProps> = ({
  isFreeMove,
  activeBoard
}) => {
  useEffect(() => {
    if (isFreeMove) {
      sounds.playUt3FreeMove();
    }
  }, [isFreeMove]);

  return (
    <div className="w-full max-w-sm mx-auto px-3 py-1 z-20 select-none font-sans flex-shrink-0">
      <AnimatePresence mode="wait">
        {isFreeMove ? (
          <motion.div
            key="free-move-banner"
            initial={{ opacity: 0, y: -5, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 5, scale: 0.95 }}
            className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 via-yellow-500/25 to-amber-500/20 border border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.25)] backdrop-blur-md flex items-center justify-between text-amber-200"
          >
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-spin" style={{ animationDuration: '6s' }} />
              <span className="font-black text-xs text-white uppercase tracking-wider">FREE MOVE</span>
            </div>
            <span className="text-[10px] bg-amber-400 text-black px-2 py-0.5 rounded-full font-bold">
              CHOOSE ANY BOARD
            </span>
          </motion.div>
        ) : activeBoard !== null ? (
          <motion.div
            key="active-board-banner"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="px-3 py-1.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 backdrop-blur-md flex items-center justify-between text-cyan-200"
          >
            <div className="flex items-center gap-1.5">
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-[10px] text-gray-400 font-semibold uppercase">TARGET:</span>
            </div>
            <div className="font-black text-xs text-cyan-300 tracking-wider">
              {BOARD_NAMES[activeBoard]} BOARD ({activeBoard + 1})
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};

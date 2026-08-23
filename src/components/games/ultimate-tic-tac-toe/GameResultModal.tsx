"use client";

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RefreshCw, LogOut, Award, Clock, Flame } from 'lucide-react';
import { sounds } from '@/lib/sounds';

interface GameResultModalProps {
  isOpen: boolean;
  winnerSymbol: 'X' | 'O' | null;
  winnerNickname?: string;
  isDraw: boolean;
  mySymbol: 'X' | 'O';
  boardsWonX: number;
  boardsWonO: number;
  moveCount: number;
  onPlayAgain: () => void;
  onExit: () => void;
}

export const GameResultModal: React.FC<GameResultModalProps> = ({
  isOpen,
  winnerSymbol,
  winnerNickname,
  isDraw,
  mySymbol,
  boardsWonX,
  boardsWonO,
  moveCount,
  onPlayAgain,
  onExit
}) => {
  const isWinner = winnerSymbol === mySymbol;

  useEffect(() => {
    if (isOpen) {
      if (isWinner) {
        sounds.playUt3GameWin();
      } else if (isDraw) {
        sounds.playUt3GameDraw();
      } else {
        sounds.playUt3GameDraw();
      }
    }
  }, [isOpen, isWinner, isDraw]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-neutral-900 border border-white/15 rounded-3xl p-6 md:p-8 max-w-md w-full text-center relative shadow-2xl overflow-hidden"
        >
          {/* Top Decorative Glow */}
          <div
            className={`absolute top-0 left-1/2 -translate-x-1/2 w-48 h-1 bg-gradient-to-r ${
              isWinner
                ? 'from-cyan-400 via-indigo-500 to-emerald-400'
                : isDraw
                ? 'from-amber-400 to-yellow-600'
                : 'from-rose-500 to-pink-600'
            }`}
          />

          {/* Icon Badge */}
          <div className="w-20 h-20 mx-auto mb-4 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center text-4xl shadow-xl">
            {isWinner ? '🏆' : isDraw ? '🤝' : '💀'}
          </div>

          {/* Result Title */}
          <h2 className="text-3xl font-black text-white tracking-wide uppercase mb-1">
            {isWinner ? 'VICTORY!' : isDraw ? 'DRAW MATCH' : 'DEFEAT'}
          </h2>

          <p className="text-sm text-gray-400 font-medium mb-6">
            {isWinner
              ? 'Congratulations! You won 3 mini-boards in a row on the main board!'
              : isDraw
              ? 'No player completed three mini-boards in a row. Well played!'
              : `${winnerNickname || `Player ${winnerSymbol}`} conquered 3 mini-boards in a row.`}
          </p>

          {/* Match Stats */}
          <div className="grid grid-cols-2 gap-3 mb-6 bg-white/5 p-4 rounded-2xl border border-white/10 text-left">
            <div>
              <span className="text-[11px] text-gray-400 font-semibold block uppercase">Player X Boards</span>
              <strong className="text-cyan-400 text-lg font-black">{boardsWonX} Won</strong>
            </div>
            <div>
              <span className="text-[11px] text-gray-400 font-semibold block uppercase">Player O Boards</span>
              <strong className="text-rose-400 text-lg font-black">{boardsWonO} Won</strong>
            </div>
            <div className="col-span-2 border-t border-white/10 pt-2.5 flex items-center justify-between text-xs text-gray-400 font-semibold">
              <span>Total Moves Made:</span>
              <strong className="text-white font-bold">{moveCount} Moves</strong>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onPlayAgain}
              className="flex-1 py-3 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" /> Play Again
            </button>
            <button
              onClick={onExit}
              className="py-3 px-4 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> Exit
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

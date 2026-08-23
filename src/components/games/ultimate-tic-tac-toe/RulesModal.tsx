"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X, Sparkles, Compass } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 30, scale: 0.95 }}
          animate={{ y: 0, scale: 1 }}
          exit={{ y: 30, scale: 0.95 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-neutral-900 border border-white/15 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl custom-scrollbar"
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-cyan-400" /> Ultimate Tic-Tac-Toe Rules
            </h2>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4 text-xs sm:text-sm text-gray-300 leading-relaxed">
            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <strong className="text-cyan-400 block font-bold mb-1">1. The Board</strong>
              <p>The game takes place on a 3x3 grid of 9 mini 3x3 Tic-Tac-Toe boards (81 total playable cells).</p>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <strong className="text-cyan-400 block font-bold mb-1">2. Forced Board System</strong>
              <p>Your move in a mini-cell determines the mini-board your opponent must play in next!</p>
              <p className="text-gray-400 text-xs mt-1">Example: Playing in the top-right cell forces your opponent to play in the top-right mini-board.</p>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <strong className="text-amber-400 block font-bold mb-1 flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> 3. Free Move Rule
              </strong>
              <p>If you are sent to a mini-board that is already won or completely full, you get a <strong>FREE MOVE</strong>! You may play in any available open board.</p>
            </div>

            <div className="bg-white/5 p-3 rounded-2xl border border-white/10">
              <strong className="text-cyan-400 block font-bold mb-1">4. Winning the Game</strong>
              <p>Win a mini-board by aligning 3 of your marks in a row. The first player to win <strong>3 mini-boards in a row on the main board</strong> wins the match!</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="mt-6 w-full py-3 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold transition-all shadow-lg shadow-cyan-500/25"
          >
            Got it! Let&apos;s Play
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface PlayerStatusProps {
  playerX: { nickname: string; isOnline?: boolean };
  playerO: { nickname: string; isOnline?: boolean };
  currentTurnSymbol: 'X' | 'O';
  mySymbol: 'X' | 'O';
  boardsWonX: number;
  boardsWonO: number;
}

export const PlayerStatus: React.FC<PlayerStatusProps> = ({
  playerX,
  playerO,
  currentTurnSymbol,
  mySymbol,
  boardsWonX,
  boardsWonO
}) => {
  const isTurnX = currentTurnSymbol === 'X';
  const isTurnO = currentTurnSymbol === 'O';
  const isMyTurn = currentTurnSymbol === mySymbol;

  return (
    <div className="w-full max-w-xl mx-auto px-3 py-1 flex items-center justify-between gap-2 select-none font-sans flex-shrink-0">
      {/* Player X Card */}
      <motion.div
        animate={isTurnX ? { scale: 1.02 } : { scale: 1 }}
        className={`flex-1 px-3 py-2 rounded-xl border transition-all duration-300 backdrop-blur-md flex items-center justify-between ${
          isTurnX
            ? 'bg-cyan-500/15 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.25)] ring-1 ring-cyan-400/40'
            : 'bg-white/5 border-white/10 opacity-70'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center font-black text-sm text-white shadow flex-shrink-0">
            X
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-xs sm:text-sm text-white truncate leading-tight">{playerX.nickname}</span>
              {mySymbol === 'X' && (
                <span className="text-[8px] bg-cyan-500/30 text-cyan-300 px-1 py-0.2 rounded font-black">YOU</span>
              )}
            </div>
            <div className="text-[10px] text-cyan-400 font-semibold leading-tight">
              Won: <strong className="text-white text-xs">{boardsWonX}</strong>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Center Turn Banner */}
      <div className="flex flex-col items-center justify-center px-1 flex-shrink-0">
        <span className="text-[10px] font-black tracking-widest text-gray-500 uppercase mb-0.5">VS</span>
        <div
          className={`px-2.5 py-0.5 rounded-full text-[10px] sm:text-xs font-black tracking-wide flex items-center gap-1 border transition-all ${
            isMyTurn
              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 animate-pulse'
              : 'bg-amber-500/20 text-amber-400 border-amber-500/40'
          }`}
        >
          {isMyTurn ? 'YOUR TURN' : "OPPONENT'S TURN"}
        </div>
      </div>

      {/* Player O Card */}
      <motion.div
        animate={isTurnO ? { scale: 1.02 } : { scale: 1 }}
        className={`flex-1 px-3 py-2 rounded-xl border transition-all duration-300 backdrop-blur-md flex items-center justify-between ${
          isTurnO
            ? 'bg-rose-500/15 border-rose-400 shadow-[0_0_15px_rgba(244,63,94,0.25)] ring-1 ring-rose-400/40'
            : 'bg-white/5 border-white/10 opacity-70'
        }`}
      >
        <div className="flex items-center justify-end gap-2.5 min-w-0 w-full text-right">
          <div className="min-w-0">
            <div className="flex items-center justify-end gap-1">
              {mySymbol === 'O' && (
                <span className="text-[8px] bg-rose-500/30 text-rose-300 px-1 py-0.2 rounded font-black">YOU</span>
              )}
              <span className="font-bold text-xs sm:text-sm text-white truncate leading-tight">{playerO.nickname}</span>
            </div>
            <div className="text-[10px] text-rose-400 font-semibold leading-tight">
              Won: <strong className="text-white text-xs">{boardsWonO}</strong>
            </div>
          </div>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center font-black text-sm text-white shadow flex-shrink-0">
            O
          </div>
        </div>
      </motion.div>
    </div>
  );
};

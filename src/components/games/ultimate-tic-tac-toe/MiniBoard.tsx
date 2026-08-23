"use client";

import React from 'react';
import { motion } from 'framer-motion';
import { Cell } from './Cell';

interface MiniBoardProps {
  boardIndex: number;
  cells: (string | null)[];
  wonOwner: string | null; // null, 'X', 'O', 'DRAW'
  winningLine: number[] | null;
  isActiveBoard: boolean;
  isFreeMove: boolean;
  isMyTurn: boolean;
  mySymbol: 'X' | 'O';
  onCellClick: (boardIndex: number, cellIndex: number) => void;
}

export const MiniBoard: React.FC<MiniBoardProps> = ({
  boardIndex,
  cells,
  wonOwner,
  winningLine,
  isActiveBoard,
  isFreeMove,
  isMyTurn,
  mySymbol,
  onCellClick
}) => {
  const isResolved = wonOwner !== null;
  const isPlayable = !isResolved && (isFreeMove || isActiveBoard);

  return (
    <motion.div
      animate={
        isActiveBoard && isMyTurn && !isResolved
          ? { scale: [1, 1.015, 1] }
          : { scale: 1 }
      }
      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      className={`relative p-2 rounded-2xl transition-all duration-300 backdrop-blur-md flex flex-col justify-between ${
        isActiveBoard && !isResolved
          ? isFreeMove
            ? 'bg-gradient-to-b from-yellow-500/10 to-amber-950/20 border-2 border-amber-400/80 shadow-[0_0_25px_rgba(245,158,11,0.25)] z-20'
            : 'bg-gradient-to-b from-cyan-500/10 to-indigo-950/20 border-2 border-cyan-400/80 shadow-[0_0_25px_rgba(56,189,248,0.3)] z-20'
          : isResolved
          ? 'bg-black/50 border border-white/10 opacity-80'
          : 'bg-black/30 border border-white/10 opacity-70 hover:opacity-90'
      }`}
    >
      {/* Floating Active Badge */}
      {isActiveBoard && !isResolved && isMyTurn && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-cyan-500 text-black shadow-lg shadow-cyan-500/50 z-30 flex items-center gap-1 animate-pulse">
          <span className="w-1.5 h-1.5 rounded-full bg-black animate-ping" />
          PLAY HERE
        </div>
      )}

      {/* 3x3 Mini Cell Grid */}
      <div className="grid grid-cols-3 gap-1.5 flex-1">
        {cells.map((symbol, cellIdx) => (
          <Cell
            key={`cell-${boardIndex}-${cellIdx}`}
            boardIndex={boardIndex}
            cellIndex={cellIdx}
            symbol={symbol as 'X' | 'O' | null}
            isActiveBoard={isActiveBoard || isFreeMove}
            isMyTurn={isMyTurn}
            isBoardPlayable={!isResolved}
            mySymbol={mySymbol}
            onClick={onCellClick}
          />
        ))}
      </div>

      {/* Won Board Translucent Ownership Overlay */}
      {isResolved && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute inset-0 rounded-2xl bg-neutral-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-10 p-2 border border-white/15"
        >
          {wonOwner === 'X' && (
            <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-[0_0_15px_rgba(56,189,248,0.6)]">
              <defs>
                <linearGradient id="bigX" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="100%" stopColor="#818cf8" />
                </linearGradient>
              </defs>
              <line x1="20" y1="20" x2="80" y2="80" stroke="url(#bigX)" strokeWidth="10" strokeLinecap="round" />
              <line x1="80" y1="20" x2="20" y2="80" stroke="url(#bigX)" strokeWidth="10" strokeLinecap="round" />
            </svg>
          )}

          {wonOwner === 'O' && (
            <svg viewBox="0 0 100 100" className="w-20 h-20 sm:w-24 sm:h-24 drop-shadow-[0_0_15px_rgba(244,63,94,0.6)]">
              <defs>
                <linearGradient id="bigO" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#f43f5e" />
                  <stop offset="100%" stopColor="#fb923c" />
                </linearGradient>
              </defs>
              <circle cx="50" cy="50" r="32" stroke="url(#bigO)" strokeWidth="10" fill="none" strokeLinecap="round" />
            </svg>
          )}

          {wonOwner === 'DRAW' && (
            <div className="flex flex-col items-center gap-1">
              <span className="text-xl sm:text-2xl font-black text-gray-400 tracking-widest uppercase">DRAW</span>
              <span className="text-[10px] text-gray-500 font-semibold">No Owner</span>
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
};

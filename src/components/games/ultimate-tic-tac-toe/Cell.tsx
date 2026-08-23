"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { sounds } from '@/lib/sounds';

interface CellProps {
  boardIndex: number;
  cellIndex: number;
  symbol: 'X' | 'O' | null;
  isActiveBoard: boolean;
  isMyTurn: boolean;
  isBoardPlayable: boolean;
  mySymbol: 'X' | 'O';
  onClick: (boardIndex: number, cellIndex: number) => void;
}

const BOARD_POSITIONS = ['Top-Left', 'Top-Center', 'Top-Right', 'Middle-Left', 'Center', 'Middle-Right', 'Bottom-Left', 'Bottom-Center', 'Bottom-Right'];
const CELL_POSITIONS = ['Top-Left', 'Top-Center', 'Top-Right', 'Middle-Left', 'Center', 'Middle-Right', 'Bottom-Left', 'Bottom-Center', 'Bottom-Right'];

export const Cell: React.FC<CellProps> = ({
  boardIndex,
  cellIndex,
  symbol,
  isActiveBoard,
  isMyTurn,
  isBoardPlayable,
  mySymbol,
  onClick
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isShaking, setIsShaking] = useState(false);

  const canClick = isBoardPlayable && isActiveBoard && isMyTurn && symbol === null;

  const handleClick = () => {
    if (canClick) {
      sounds.playUt3CellClick();
      onClick(boardIndex, cellIndex);
    } else if (symbol === null && (!isActiveBoard || !isMyTurn || !isBoardPlayable)) {
      sounds.playUt3Invalid();
      setIsShaking(true);
      setTimeout(() => setIsShaking(false), 400);
    }
  };

  const ariaLabel = `${BOARD_POSITIONS[boardIndex]} board, ${CELL_POSITIONS[cellIndex]} cell${symbol ? `, occupied by ${symbol}` : ''}`;

  return (
    <motion.button
      type="button"
      aria-label={ariaLabel}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      animate={isShaking ? { x: [-3, 3, -3, 3, 0] } : {}}
      transition={{ duration: 0.3 }}
      className={`relative flex items-center justify-center rounded-xl transition-all duration-200 aspect-square select-none overflow-hidden ${
        symbol !== null
          ? 'bg-white/5 border border-white/10 cursor-default'
          : canClick
          ? 'bg-white/10 hover:bg-cyan-500/20 border border-white/15 hover:border-cyan-400/60 cursor-pointer shadow-sm hover:shadow-cyan-500/20 hover:scale-[1.03] active:scale-95'
          : 'bg-black/40 border border-white/5 cursor-not-allowed opacity-60'
      }`}
    >
      {/* Symbol Display */}
      {symbol === 'X' && (
        <svg viewBox="0 0 40 40" className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 p-1">
          <defs>
            <linearGradient id="xGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#38bdf8" />
              <stop offset="100%" stopColor="#818cf8" />
            </linearGradient>
          </defs>
          <motion.line
            x1="8" y1="8" x2="32" y2="32"
            stroke="url(#xGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2 }}
          />
          <motion.line
            x1="32" y1="8" x2="8" y2="32"
            stroke="url(#xGrad)"
            strokeWidth="4"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.2, delay: 0.08 }}
          />
        </svg>
      )}

      {symbol === 'O' && (
        <svg viewBox="0 0 40 40" className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 p-1">
          <defs>
            <linearGradient id="oGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#f43f5e" />
              <stop offset="100%" stopColor="#fb923c" />
            </linearGradient>
          </defs>
          <motion.circle
            cx="20" cy="20" r="12"
            stroke="url(#oGrad)"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.25 }}
          />
        </svg>
      )}

      {/* Hover Preview for human player */}
      {symbol === null && canClick && isHovered && (
        <div className="opacity-30 pointer-events-none">
          {mySymbol === 'X' ? (
            <svg viewBox="0 0 40 40" className="w-6 h-6 p-1 text-cyan-400">
              <line x1="8" y1="8" x2="32" y2="32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="32" y1="8" x2="8" y2="32" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 40 40" className="w-6 h-6 p-1 text-rose-400">
              <circle cx="20" cy="20" r="12" stroke="currentColor" strokeWidth="4" fill="none" />
            </svg>
          )}
        </div>
      )}
    </motion.button>
  );
};

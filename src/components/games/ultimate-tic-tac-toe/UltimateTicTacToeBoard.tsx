"use client";

import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { MiniBoard } from './MiniBoard';

interface UltimateTicTacToeBoardProps {
  miniBoards: (string | null)[][];
  wonBoards: (string | null)[];
  miniBoardWinningLines: (number[] | null)[];
  mainBoardWinningLine: number[] | null;
  activeBoard: number | null;
  isFreeMove: boolean;
  isMyTurn: boolean;
  mySymbol: 'X' | 'O';
  onCellClick: (boardIndex: number, cellIndex: number) => void;
}

export const UltimateTicTacToeBoard: React.FC<UltimateTicTacToeBoardProps> = ({
  miniBoards,
  wonBoards,
  miniBoardWinningLines,
  mainBoardWinningLine,
  activeBoard,
  isFreeMove,
  isMyTurn,
  mySymbol,
  onCellClick
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [boardCoords, setBoardCoords] = useState<{ x: number; y: number }[]>([]);

  // Calculate center coordinates of 9 mini boards for the SVG victory line
  useEffect(() => {
    const updateCoords = () => {
      if (!containerRef.current) return;
      const rects = containerRef.current.querySelectorAll('.mini-board-wrapper');
      const coords: { x: number; y: number }[] = [];
      const parentRect = containerRef.current.getBoundingClientRect();

      rects.forEach((el) => {
        const r = el.getBoundingClientRect();
        coords.push({
          x: r.left - parentRect.left + r.width / 2,
          y: r.top - parentRect.top + r.height / 2
        });
      });
      setBoardCoords(coords);
    };

    updateCoords();
    window.addEventListener('resize', updateCoords);
    return () => window.removeEventListener('resize', updateCoords);
  }, [miniBoards, wonBoards, mainBoardWinningLine]);

  return (
    <div className="relative w-full max-w-[min(90vw,calc(100vh-175px))] aspect-square mx-auto p-1 sm:p-2 flex items-center justify-center font-sans">
      {/* Outer Grid Container */}
      <div
        ref={containerRef}
        className="relative w-full h-full grid grid-cols-3 gap-2 sm:gap-3 p-2 sm:p-3 rounded-2xl bg-neutral-950/90 border border-white/15 shadow-2xl backdrop-blur-xl"
      >
        {/* Main Board 3x3 Grid Accent Dividers */}
        <div className="absolute inset-2 sm:inset-3 pointer-events-none grid grid-cols-3 grid-rows-3 gap-2 sm:gap-3 z-0">
          <div className="border-r-2 border-b-2 border-white/15" />
          <div className="border-r-2 border-b-2 border-white/15" />
          <div className="border-b-2 border-white/15" />
          <div className="border-r-2 border-b-2 border-white/15" />
          <div className="border-r-2 border-b-2 border-white/15" />
          <div className="border-b-2 border-white/15" />
          <div className="border-r-2 border-white/15" />
          <div className="border-r-2 border-white/15" />
          <div />
        </div>

        {/* 9 Mini Boards */}
        {miniBoards.map((cells, boardIdx) => (
          <div key={`mini-wrapper-${boardIdx}`} className="mini-board-wrapper relative z-10 flex flex-col h-full">
            <MiniBoard
              boardIndex={boardIdx}
              cells={cells}
              wonOwner={wonBoards[boardIdx]}
              winningLine={miniBoardWinningLines[boardIdx]}
              isActiveBoard={activeBoard === boardIdx}
              isFreeMove={isFreeMove}
              isMyTurn={isMyTurn}
              mySymbol={mySymbol}
              onCellClick={onCellClick}
            />
          </div>
        ))}

        {/* Main Board Victory Line Overlay */}
        {mainBoardWinningLine && boardCoords.length === 9 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-40 drop-shadow-[0_0_20px_rgba(234,179,8,0.8)]">
            <defs>
              <linearGradient id="mainWinGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="100%" stopColor="#f43f5e" />
              </linearGradient>
            </defs>
            <motion.line
              x1={boardCoords[mainBoardWinningLine[0]].x}
              y1={boardCoords[mainBoardWinningLine[0]].y}
              x2={boardCoords[mainBoardWinningLine[2]].x}
              y2={boardCoords[mainBoardWinningLine[2]].y}
              stroke="url(#mainWinGrad)"
              strokeWidth="10"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </svg>
        )}
      </div>
    </div>
  );
};

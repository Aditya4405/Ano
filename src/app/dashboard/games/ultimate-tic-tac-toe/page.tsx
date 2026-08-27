"use client";

import { Suspense } from 'react';
import { UltimateTicTacToeGameHub } from '@/components/games/ultimate-tic-tac-toe/UltimateTicTacToeGameHub';

export default function UltimateTicTacToePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center text-white">
          <div className="text-center space-y-3">
            <div className="text-3xl font-black text-white tracking-wide">
              Ultimate <span className="text-cyan-400">Tic-Tac-Toe</span>
            </div>
            <div className="text-gray-400 text-sm">Loading game arena...</div>
          </div>
        </div>
      }
    >
      <UltimateTicTacToeGameHub />
    </Suspense>
  );
}

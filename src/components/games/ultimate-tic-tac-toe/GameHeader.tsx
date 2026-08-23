"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Clock, RefreshCw } from 'lucide-react';

interface GameHeaderProps {
  onBack?: () => void;
  backTitle?: string;
  onOpenRules: () => void;
  turnExpiresAt?: number | null;
  turnTimeLeft?: number;
  isMyTurn?: boolean;
  status?: string;
  onResetPractice?: () => void;
  isSinglePlayer?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  onBack,
  backTitle,
  onOpenRules,
  turnExpiresAt,
  turnTimeLeft: propTimeLeft,
  status,
  onResetPractice,
  isSinglePlayer
}) => {
  const [secondsLeft, setSecondsLeft] = useState<number>(propTimeLeft ?? 30);

  // Live timer tick calculation
  useEffect(() => {
    if (status !== 'PLAYING') return;

    if (turnExpiresAt) {
      const updateTimer = () => {
        const remaining = Math.max(0, Math.ceil((turnExpiresAt - Date.now()) / 1000));
        setSecondsLeft(remaining);
      };
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    } else if (propTimeLeft !== undefined) {
      setSecondsLeft(propTimeLeft);
    }
  }, [turnExpiresAt, propTimeLeft, status]);

  const formattedTime = secondsLeft < 10 ? `0${secondsLeft}` : `${secondsLeft}`;

  return (
    <header className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0 z-30 backdrop-blur-md font-sans">
      <div className="flex items-center gap-3 sm:gap-4">
        {onBack ? (
          <button
            onClick={onBack}
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title={backTitle || "Back"}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        ) : (
          <Link
            href="/dashboard/games"
            className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
            title="Back to Arcade"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
        )}

        <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
          <img src="/ano-logo.png" alt="Ano Logo" className="w-8 h-8 object-contain group-hover:scale-105 transition-transform flex-shrink-0" />
          <span className="text-lg font-bold text-white tracking-wide">Ano</span>
        </Link>

        <div className="ml-1 sm:ml-2 border-l border-white/20 pl-3 sm:pl-4">
          <h1 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2">
            <span>📐</span>
            <span className="truncate">Ultimate Tic-Tac-Toe</span>
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Turn Timer Badge */}
        {status === 'PLAYING' && (
          <div
            className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 border transition-all ${
              secondsLeft <= 10
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-white/5 text-cyan-300 border-cyan-500/30 shadow-sm'
            }`}
          >
            <Clock className={`w-3.5 h-3.5 ${secondsLeft <= 10 ? 'text-rose-400' : 'text-cyan-400'}`} />
            <span>00:{formattedTime}</span>
          </div>
        )}

        {/* Practice Restart Button */}
        {isSinglePlayer && onResetPractice && (
          <button
            onClick={onResetPractice}
            className="p-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Restart Practice Match"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Rules Button */}
        <button
          onClick={onOpenRules}
          className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
        >
          <BookOpen className="w-4 h-4 text-cyan-400" />
          <span className="hidden sm:inline">Rules</span>
        </button>
      </div>
    </header>
  );
};

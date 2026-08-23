"use client";

import React, { useEffect, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX, BookOpen, Clock, RefreshCw } from 'lucide-react';

interface GameHeaderProps {
  onBack: () => void;
  onOpenRules: () => void;
  turnExpiresAt?: number | null;
  turnTimeLeft?: number;
  isMyTurn?: boolean;
  status?: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onResetPractice?: () => void;
  isSinglePlayer?: boolean;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  onBack,
  onOpenRules,
  turnExpiresAt,
  turnTimeLeft: propTimeLeft,
  isMyTurn,
  status,
  isMuted,
  onToggleMute,
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
    <header className="w-full flex items-center justify-between px-3 py-2.5 bg-neutral-950/80 border-b border-white/10 backdrop-blur-md z-30 select-none font-sans flex-shrink-0">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/10"
          title="Back"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-2.5">
          <span className="text-xl">📐</span>
          <div>
            <h1 className="text-sm sm:text-base font-black tracking-wide text-white leading-none">
              Ultimate Tic-Tac-Toe
            </h1>
            <span className="text-[10px] text-cyan-400 font-semibold tracking-wide">
              {isSinglePlayer ? 'Practice vs AI' : 'Multiplayer Arena'}
            </span>
          </div>
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
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
            title="Restart Match"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}

        {/* Rules Button */}
        <button
          onClick={onOpenRules}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold text-gray-300 hover:text-white flex items-center gap-1.5 transition-all cursor-pointer"
        >
          <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
          <span className="hidden sm:inline">Rules</span>
        </button>

        {/* Mute Toggle */}
        <button
          onClick={onToggleMute}
          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white transition-all cursor-pointer"
          title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
        >
          {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-emerald-400" />}
        </button>
      </div>
    </header>
  );
};

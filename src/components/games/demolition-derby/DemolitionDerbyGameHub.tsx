'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUserStore } from '@/store/useUserStore';
import { useDemolitionDerbyStore } from '@/store/useDemolitionDerbyStore';
import { DemolitionDerbyCanvas } from './DemolitionDerbyCanvas';
import { ARENAS, computeEffectiveStats, VEHICLES } from './DerbyPhysicsEngine';
import {
  AIDifficulty,
  ArenaId,
  VehicleId,
} from './types';
import { derbySoundSystem } from './DerbySoundSystem';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Play,
  Users,
  Volume2,
  VolumeX,
  Lock,
  CheckCircle2,
  Coins,
  Sparkles,
  Flame,
  ChevronRight,
  SlidersHorizontal,
  Copy,
  Check,
  Compass,
} from 'lucide-react';

type ActiveView =
  | 'MENU'
  | 'SOLO_DIFFICULTY'
  | 'ARENA_SELECT'
  | 'GARAGE'
  | 'MULTIPLAYER_LOBBY'
  | 'GAMEPLAY'
  | 'RESULTS';

export function DemolitionDerbyGameHub() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams?.get('room');

  const userId = useUserStore((s) => s.id) || 'guest';
  const nickname = useUserStore((s) => s.nickname) || 'Player';

  const {
    coins,
    xp,
    unlockedVehicles,
    selectedVehicle,
    vehicleUpgrades,
    unlockedArenas,
    completedArenas,
    currentArena,
    bestScores,
    selectedDifficulty,
    soundMuted,
    roomState,
    availableLobbies,
    selectVehicle,
    unlockVehicle,
    upgradeVehicleStat,
    selectDifficulty,
    selectArena,
    recordMatchResult,
    toggleSound,
    initLobbySockets,
    createLobby,
    joinLobby,
    toggleReady,
    startMatch,
    leaveLobby,
    sendTransformUpdate,
  } = useDemolitionDerbyStore();

  const [activeView, setActiveView] = useState<ActiveView>('MENU');
  const [isMultiplayer, setIsMultiplayer] = useState<boolean>(false);

  // HUD Metrics
  const [playerHp, setPlayerHp] = useState(100);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [opponentsRemaining, setOpponentsRemaining] = useState(7);
  const [matchTimerSeconds, setMatchTimerSeconds] = useState(0);
  const [copiedCode, setCopiedCode] = useState(false);

  // Results State
  const [lastMatchResult, setLastMatchResult] = useState<{
    rank: number;
    score: number;
    eliminations: number;
    damageDealt: number;
    survivalTime: number;
    isWin: boolean;
    coinsEarned: number;
    xpEarned: number;
    newArenaUnlocked: ArenaId | null;
  } | null>(null);

  // Session Key for fresh canvas mounting on replay
  const [gameSessionKey, setGameSessionKey] = useState(0);

  // Initialize sockets
  useEffect(() => {
    if (userId) {
      const cleanup = initLobbySockets(userId);
      return () => cleanup();
    }
  }, [userId, initLobbySockets]);

  // Handle URL Room Parameter
  useEffect(() => {
    if (roomCodeParam && userId && nickname && !roomState) {
      setActiveView('MULTIPLAYER_LOBBY');
      setIsMultiplayer(true);
      joinLobby(roomCodeParam, userId, nickname);
    }
  }, [roomCodeParam, userId, nickname, roomState, joinLobby]);

  // Room State Sync
  useEffect(() => {
    if (roomState) {
      if (roomState.status === 'PLAYING' || roomState.status === 'COUNTDOWN') {
        if (activeView !== 'GAMEPLAY') {
          setActiveView('GAMEPLAY');
          setIsMultiplayer(true);
        }
      } else if (roomState.status === 'LOBBY') {
        if (activeView !== 'MULTIPLAYER_LOBBY') {
          setActiveView('MULTIPLAYER_LOBBY');
          setIsMultiplayer(true);
        }
      } else if (roomState.status === 'FINISHED') {
        setActiveView('RESULTS');
      }
    }
  }, [roomState, activeView]);

  const handlePlaySound = (type: string) => {
    if (type === 'click') derbySoundSystem.playClick();
  };

  const handleHudUpdate = useCallback(
    (hp: number, score: number, combo: number, opponentsAlive: number, timerSec: number) => {
      setPlayerHp(hp);
      setCurrentScore(score);
      setCurrentCombo(combo);
      setOpponentsRemaining(opponentsAlive);
      setMatchTimerSeconds(timerSec);
    },
    []
  );

  const handleMatchComplete = useCallback(
    (
      rank: number,
      score: number,
      eliminations: number,
      damageDealt: number,
      survivalTime: number,
      isWin: boolean
    ) => {
      const rewards = recordMatchResult(currentArena, score, survivalTime, eliminations, isWin);

      setLastMatchResult({
        rank,
        score,
        eliminations,
        damageDealt,
        survivalTime,
        isWin,
        coinsEarned: rewards.coinsEarned,
        xpEarned: rewards.xpEarned,
        newArenaUnlocked: rewards.newArenaUnlocked,
      });

      setActiveView('RESULTS');
    },
    [currentArena, recordMatchResult]
  );

  const currentArenaDef = ARENAS[currentArena] || ARENAS.arena_1;
  const selectedVehicleDef = VEHICLES[selectedVehicle] || VEHICLES.starter;
  const currentStats = computeEffectiveStats(selectedVehicle, vehicleUpgrades[selectedVehicle]);

  const getHpDetails = (hp: number) => {
    if (hp > 75) return { color: 'bg-emerald-500', text: 'HEALTHY' };
    if (hp > 50) return { color: 'bg-amber-500', text: 'DAMAGED' };
    if (hp > 25) return { color: 'bg-orange-500', text: 'HEAVY DAMAGE' };
    if (hp > 0) return { color: 'bg-red-600', text: 'CRITICAL' };
    return { color: 'bg-zinc-800', text: 'DESTROYED' };
  };

  const hpInfo = getHpDetails(playerHp);

  // ── TOP COMPACT NAV BAR ────────────────────────────────────
  const renderNavbar = () => (
    <div className="flex items-center justify-between px-4 py-2.5 bg-neutral-900 border-b border-white/10 flex-shrink-0 z-30 shadow-md">
      <div className="flex items-center gap-3">
        {activeView !== 'MENU' ? (
          <button
            onClick={() => {
              handlePlaySound('click');
              if (roomState) leaveLobby(userId);
              setActiveView('MENU');
            }}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Back to Menu"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        ) : (
          <Link
            href="/dashboard/games"
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white transition-colors cursor-pointer border border-white/10"
            title="Back to Arcade"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 via-red-600 to-amber-700 flex items-center justify-center text-white font-black text-xs">
            🏎️
          </div>
          <div>
            <h1 className="text-sm font-black text-white tracking-wide uppercase flex items-center gap-2">
              <span>Demolition Derby</span>
            </h1>
            <span className="text-[9px] text-amber-400 font-semibold tracking-wider uppercase block -mt-0.5">
              {isMultiplayer ? 'Multiplayer Battle' : 'Solo Arena Campaign'}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-extrabold shadow-sm">
          <Coins className="w-3 h-3 text-amber-400 shrink-0" />
          <span className="tabular-nums">{coins.toLocaleString()} C</span>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded-full text-cyan-400 text-xs font-bold">
          <Sparkles className="w-3 h-3 text-cyan-400" />
          <span>{xp.toLocaleString()} XP</span>
        </div>

        <button
          onClick={() => {
            handlePlaySound('click');
            toggleSound();
          }}
          className="p-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-gray-300 hover:text-white transition-colors cursor-pointer"
        >
          {soundMuted ? <VolumeX className="w-3.5 h-3.5 text-red-400" /> : <Volume2 className="w-3.5 h-3.5 text-emerald-400" />}
        </button>
      </div>
    </div>
  );

  // ── 1. MAIN MENU VIEW ──────────────────────────────────────
  const renderMenu = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-xl w-full space-y-8 my-auto text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Flame className="w-4 h-4 text-amber-500" /> Vehicular Demolition Combat
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white uppercase italic">
            Ano <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-red-500 to-amber-600">Demolition Derby</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
            Crash into opponents, deal high-speed collision damage, eliminate enemy cars, and survive as the last vehicle operational!
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md shadow-xl text-left">
          <div className="space-y-1">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Equipped Vehicle</div>
            <div className="text-base font-extrabold text-white flex items-center gap-2">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedVehicleDef.color }} />
              {selectedVehicleDef.name}
            </div>
            <div className="text-xs text-amber-400 font-semibold">Speed: {currentStats.speed} • Armor: {currentStats.armor}</div>
          </div>

          <div className="space-y-1 border-l border-white/10 pl-4">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">Current Arena</div>
            <div className="text-base font-extrabold text-cyan-400 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-cyan-400" />
              {currentArenaDef.name}
            </div>
            <div className="text-xs text-gray-400 font-medium">{currentArenaDef.difficultyTag}</div>
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => {
              handlePlaySound('click');
              setIsMultiplayer(false);
              setActiveView('SOLO_DIFFICULTY');
            }}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-red-600 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-lg uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/20 flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.02]"
          >
            <Play className="w-6 h-6 fill-white group-hover:translate-x-0.5 transition-transform" />
            <span>SOLO MODE</span>
          </button>

          <button
            onClick={() => {
              handlePlaySound('click');
              setIsMultiplayer(true);
              setActiveView('MULTIPLAYER_LOBBY');
            }}
            className="w-full py-4 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white font-black text-lg uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.02]"
          >
            <Users className="w-6 h-6 text-white" />
            <span>MULTIPLAYER</span>
          </button>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={() => {
                handlePlaySound('click');
                setActiveView('GARAGE');
              }}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <SlidersHorizontal className="w-4 h-4 text-amber-400" />
              <span>GARAGE</span>
            </button>

            <button
              onClick={() => {
                handlePlaySound('click');
                setActiveView('ARENA_SELECT');
              }}
              className="py-3 px-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>ARENAS</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 2. SOLO DIFFICULTY SELECTION ──────────────────────────
  const renderSoloDifficulty = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-lg w-full space-y-6 my-auto text-center">
        <div className="space-y-2">
          <h2 className="text-3xl font-black text-white uppercase tracking-wide">SELECT DIFFICULTY</h2>
          <p className="text-gray-400 text-xs md:text-sm">Choose AI aggression and combat reaction behavior</p>
        </div>

        <div className="space-y-3">
          {[
            {
              id: 'EASY' as AIDifficulty,
              title: 'EASY',
              tagline: 'Perfect for beginners',
              desc: 'Lower bot aggression, slower reaction, less accurate ramming, and more forgiving gameplay.',
              badge: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
              border: 'hover:border-emerald-500/60',
              icon: '🟢',
            },
            {
              id: 'MEDIUM' as AIDifficulty,
              title: 'MEDIUM',
              tagline: 'Balanced challenge',
              desc: 'Moderate bot aggression, balanced target selection, accurate driving, and moderate attacks.',
              badge: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
              border: 'hover:border-amber-500/60',
              icon: '🟡',
            },
            {
              id: 'DIFFICULT' as AIDifficulty,
              title: 'DIFFICULT',
              tagline: 'Only the strongest survive',
              desc: 'Highly aggressive AI, fast reaction, relentless ramming, and strategic weak-vehicle targeting.',
              badge: 'bg-red-500/20 text-red-400 border-red-500/30',
              border: 'hover:border-red-500/60',
              icon: '🔴',
            },
          ].map((d) => (
            <div
              key={d.id}
              onClick={() => {
                handlePlaySound('click');
                selectDifficulty(d.id);
              }}
              className={`p-4 bg-neutral-900 border rounded-2xl text-left cursor-pointer transition-all ${
                selectedDifficulty === d.id
                  ? 'border-amber-500 bg-amber-500/10 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/50'
                  : `border-white/10 ${d.border}`
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{d.icon}</span>
                  <span className="font-extrabold text-white text-lg tracking-wide">{d.title}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border ${d.badge}`}>
                    {d.tagline}
                  </span>
                </div>
                {selectedDifficulty === d.id && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
              </div>
              <p className="text-xs text-gray-400 pl-7">{d.desc}</p>
            </div>
          ))}
        </div>

        <button
          onClick={() => {
            handlePlaySound('click');
            setMatchTimerSeconds(0);
            setCurrentScore(0);
            setCurrentCombo(0);
            setGameSessionKey((prev) => prev + 1);
            setActiveView('GAMEPLAY');
          }}
          className="w-full py-4 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white font-black text-lg uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>START DERBY MATCH</span>
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  // ── 3. ARENA SELECTION MAP ────────────────────────────────
  const renderArenaSelect = () => (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto max-w-4xl mx-auto w-full">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-black text-white uppercase tracking-wide">CAMPAIGN ARENAS</h2>
        <p className="text-gray-400 text-xs md:text-sm">Complete matches to unlock new tactical environments</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Object.values(ARENAS).map((a) => {
          const isUnlocked = unlockedArenas.includes(a.id);
          const isCompleted = completedArenas.includes(a.id);
          const isSelected = currentArena === a.id;
          const bestScore = bestScores[a.id] || 0;

          return (
            <div
              key={a.id}
              onClick={() => {
                if (isUnlocked) {
                  handlePlaySound('click');
                  selectArena(a.id);
                }
              }}
              className={`p-4 rounded-2xl border transition-all text-left relative overflow-hidden ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/10 ring-2 ring-amber-500/50'
                  : isUnlocked
                  ? 'bg-neutral-900 border-white/10 hover:border-white/30 cursor-pointer'
                  : 'bg-neutral-950/80 border-white/5 opacity-60 cursor-not-allowed'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    ARENA {a.index} • {a.difficultyTag}
                  </div>
                  <h3 className="text-lg font-black text-white">{a.name}</h3>
                </div>
                {isCompleted ? (
                  <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> COMPLETED
                  </span>
                ) : !isUnlocked ? (
                  <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg border border-zinc-700 flex items-center gap-1">
                    <Lock className="w-3 h-3" /> LOCKED
                  </span>
                ) : isSelected ? (
                  <span className="px-2 py-1 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-lg border border-amber-500/30">
                    SELECTED
                  </span>
                ) : null}
              </div>

              <p className="text-xs text-gray-400 mb-3">{a.description}</p>

              <div className="flex items-center justify-between text-[11px] text-gray-400 border-t border-white/10 pt-2">
                <span>{a.environment}</span>
                {bestScore > 0 && (
                  <span className="text-yellow-400 font-bold tabular-nums">Best: {bestScore.toLocaleString()} pts</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 4. GARAGE & VEHICLE UPGRADES ─────────────────────────
  const renderGarage = () => (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto max-w-5xl mx-auto w-full">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-black text-white uppercase tracking-wide">VEHICLE GARAGE</h2>
        <p className="text-gray-400 text-xs md:text-sm">Unlock battle cars & upgrade stats using earned coins</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">VEHICLES</h3>
          {Object.values(VEHICLES).map((v) => {
            const isUnlocked = unlockedVehicles.includes(v.id);
            const isSelected = selectedVehicle === v.id;

            return (
              <div
                key={v.id}
                onClick={() => {
                  handlePlaySound('click');
                  selectVehicle(v.id);
                }}
                className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all flex items-center justify-between ${
                  isSelected
                    ? 'bg-amber-500/10 border-amber-500 shadow-md'
                    : isUnlocked
                    ? 'bg-neutral-900 border-white/10 hover:border-white/20'
                    : 'bg-neutral-950 border-white/5 opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: v.color }} />
                  <div>
                    <div className="font-extrabold text-white text-sm">{v.name}</div>
                    <div className="text-[10px] text-gray-400">{v.tagline}</div>
                  </div>
                </div>

                {!isUnlocked && (
                  <div className="text-xs font-bold text-amber-400 flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    <span>{v.price}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="lg:col-span-2 bg-neutral-900 border border-white/10 rounded-2xl p-6 space-y-6 text-left">
          <div className="flex justify-between items-start border-b border-white/10 pb-4">
            <div>
              <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">VEHICLE SPECS</div>
              <h2 className="text-2xl font-black text-white">{selectedVehicleDef.name}</h2>
              <p className="text-xs text-gray-400 mt-1">{selectedVehicleDef.description}</p>
            </div>

            {!unlockedVehicles.includes(selectedVehicle) ? (
              <button
                onClick={() => {
                  if (unlockVehicle(selectedVehicle)) handlePlaySound('click');
                }}
                disabled={coins < selectedVehicleDef.price}
                className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 disabled:opacity-40 text-white font-extrabold text-sm rounded-xl transition-all shadow-lg flex items-center gap-2 cursor-pointer"
              >
                <Coins className="w-4 h-4" />
                <span>UNLOCK FOR {selectedVehicleDef.price} COINS</span>
              </button>
            ) : (
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg border border-emerald-500/30">
                UNLOCKED
              </span>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider">STAT UPGRADES</h3>
            {[
              { key: 'engine' as const, label: 'Speed & Acceleration', val: currentStats.speed },
              { key: 'armor' as const, label: 'Armor Plating (HP Defense)', val: currentStats.armor },
              { key: 'ram' as const, label: 'Ramming Force', val: currentStats.ram },
              { key: 'handling' as const, label: 'Steering & Handling', val: currentStats.handling },
            ].map((st) => {
              const currentLvl = vehicleUpgrades[selectedVehicle]?.[st.key] || 0;
              const nextCost = (currentLvl + 1) * 200;
              const canUpgrade = unlockedVehicles.includes(selectedVehicle) && currentLvl < 5 && coins >= nextCost;

              return (
                <div key={st.key} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-white">{st.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400">Level {currentLvl}/5</span>
                      {currentLvl < 5 && unlockedVehicles.includes(selectedVehicle) && (
                        <button
                          onClick={() => {
                            if (upgradeVehicleStat(selectedVehicle, st.key)) handlePlaySound('click');
                          }}
                          disabled={!canUpgrade}
                          className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 disabled:opacity-30 rounded-lg font-bold text-[11px] cursor-pointer"
                        >
                          + UPGRADE ({nextCost} C)
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="w-full h-3 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-red-500 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, st.val)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  // ── 5. MULTIPLAYER LOBBY ──────────────────────────────────
  const renderMultiplayerLobby = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
      <div className="max-w-md w-full space-y-6 my-auto text-center">
        {!roomState ? (
          <div className="space-y-4">
            <h2 className="text-3xl font-black text-white uppercase tracking-wide">MULTIPLAYER DERBY</h2>
            <p className="text-gray-400 text-xs md:text-sm">Create a room or join existing battle lobbies</p>

            <button
              onClick={() => {
                handlePlaySound('click');
                createLobby(userId, nickname, currentArena);
              }}
              className="w-full py-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 to-blue-500 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 cursor-pointer"
            >
              <Play className="w-5 h-5 fill-white" />
              <span>CREATE MATCH ROOM</span>
            </button>

            <div className="space-y-2 pt-2 text-left">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">AVAILABLE LOBBIES</div>
              {availableLobbies.length === 0 ? (
                <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center text-xs text-gray-400">
                  No active derby rooms found. Create one!
                </div>
              ) : (
                availableLobbies.map((l) => (
                  <div
                    key={l.id}
                    className="p-3 bg-neutral-900 border border-white/10 rounded-xl flex items-center justify-between"
                  >
                    <div>
                      <div className="text-sm font-bold text-white">{l.hostName || 'Room'}</div>
                      <div className="text-[10px] text-gray-400">{l.players?.length || 1} Players</div>
                    </div>
                    <button
                      onClick={() => {
                        handlePlaySound('click');
                        joinLobby(l.id, userId, nickname);
                      }}
                      className="px-3 py-1.5 bg-cyan-500 text-white font-bold text-xs rounded-lg hover:bg-cyan-400 cursor-pointer"
                    >
                      JOIN
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-6 text-left shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div>
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">MATCH LOBBY</div>
                <h3 className="text-xl font-black text-white">DEMOLITION DERBY</h3>
              </div>
              <button
                onClick={() => {
                  const url = `${window.location.origin}/dashboard/games/demolition-derby?room=${roomState.id}`;
                  navigator.clipboard.writeText(url);
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2000);
                }}
                className="px-3 py-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-xs font-bold text-cyan-400 rounded-lg flex items-center gap-1.5 cursor-pointer"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'COPIED LINK' : 'SHARE LINK'}</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">PLAYERS IN LOBBY</div>
              {roomState.players.map((p) => (
                <div
                  key={p.userId}
                  className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-sm font-bold text-white"
                >
                  <div className="flex items-center gap-2">
                    <span>{p.nickname}</span>
                    {p.role === 'HOST' && (
                      <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded font-bold">
                        HOST
                      </span>
                    )}
                  </div>
                  <span className={p.isReady ? 'text-emerald-400 text-xs' : 'text-amber-400 text-xs'}>
                    {p.isReady ? 'READY' : 'NOT READY'}
                  </span>
                </div>
              ))}
            </div>

            <div className="pt-2 space-y-2">
              {roomState.hostId === userId ? (
                <button
                  onClick={() => {
                    handlePlaySound('click');
                    startMatch(roomState.id, userId);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer"
                >
                  START MATCH
                </button>
              ) : (
                <button
                  onClick={() => {
                    const localPlayer = roomState.players.find((p) => p.userId === userId);
                    toggleReady(roomState.id, userId, !localPlayer?.isReady);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer"
                >
                  TOGGLE READY
                </button>
              )}

              <button
                onClick={() => leaveLobby(userId)}
                className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs rounded-xl cursor-pointer"
              >
                LEAVE LOBBY
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ── 6. COMPACT GAMEPLAY HUD OVERLAY ────────────────────────
  const renderGameplayHud = () => (
    <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-between p-3 md:p-4">
      <div className="flex justify-between items-start gap-3 pt-2">
        {/* Top-Left: Player HP Card */}
        <div className="bg-neutral-900/90 border border-white/10 backdrop-blur-md rounded-xl p-2.5 space-y-1 w-44 md:w-52 shadow-xl pointer-events-auto">
          <div className="flex justify-between items-center text-[11px] font-black text-white">
            <span>MY VEHICLE HP</span>
            <span className="tabular-nums text-amber-400">{playerHp}%</span>
          </div>

          <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div
              className={`h-full ${hpInfo.color} rounded-full transition-all duration-300`}
              style={{ width: `${Math.max(0, playerHp)}%` }}
            />
          </div>

          <div className="text-[9px] font-bold text-gray-400 tracking-wider uppercase flex justify-between">
            <span>STATUS:</span>
            <span className={hpInfo.text === 'CRITICAL' ? 'text-red-400 animate-pulse font-extrabold' : 'text-gray-300'}>
              {hpInfo.text}
            </span>
          </div>
        </div>

        {/* Top-Center: Arena Title & Timer */}
        <div className="bg-neutral-900/90 border border-white/10 backdrop-blur-md rounded-xl px-4 py-1.5 text-center shadow-xl">
          <div className="text-[9px] text-amber-400 font-bold uppercase tracking-wider">{currentArenaDef.name}</div>
          <div className="text-lg font-black text-white tabular-nums tracking-wide">
            {Math.floor(matchTimerSeconds / 60)}:{(matchTimerSeconds % 60).toString().padStart(2, '0')}
          </div>
        </div>

        {/* Top-Right: Score & Opponent Counter */}
        <div className="bg-neutral-900/90 border border-white/10 backdrop-blur-md rounded-xl p-2.5 text-right space-y-0.5 shadow-xl">
          <div className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">SCORE</div>
          <div className="text-lg font-black text-emerald-400 tabular-nums">{currentScore.toLocaleString()}</div>
          <div className="text-[10px] text-amber-400 font-bold">
            {opponentsRemaining} VEHICLES REMAIN
          </div>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div className="flex justify-between items-end pb-1 pointer-events-none">
        {/* Desktop Hint */}
        <div className="hidden md:block text-[10px] font-bold text-gray-400 bg-neutral-900/90 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">
          WASD / ARROWS — DRIVE • SPACE — DRIFT • R — RESET
        </div>

        {/* Touch Controls for Mobile */}
        <div className="md:hidden flex justify-between items-center w-full pointer-events-auto px-2 pb-2">
          {/* Steering Buttons */}
          <div className="flex gap-2">
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyA', key: 'a' }))}
              onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyA', key: 'a' }))}
              className="w-14 h-14 bg-neutral-900/90 border border-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-white active:bg-amber-500 active:scale-95 shadow-xl"
            >
              ◀
            </button>
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD', key: 'd' }))}
              onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyD', key: 'd' }))}
              className="w-14 h-14 bg-neutral-900/90 border border-white/20 rounded-2xl flex items-center justify-center text-xl font-black text-white active:bg-amber-500 active:scale-95 shadow-xl"
            >
              ▶
            </button>
          </div>

          {/* Throttle, Reverse & Drift Buttons */}
          <div className="flex gap-2">
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ' }))}
              onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space', key: ' ' }))}
              className="w-12 h-12 bg-amber-600/80 border border-amber-400/40 rounded-xl flex items-center justify-center text-xs font-black text-white active:bg-amber-500 shadow-xl"
            >
              DRIFT
            </button>
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyS', key: 's' }))}
              onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyS', key: 's' }))}
              className="w-14 h-14 bg-red-900/80 border border-red-500/40 rounded-2xl flex items-center justify-center text-xl font-black text-white active:bg-red-600 active:scale-95 shadow-xl"
            >
              ▼
            </button>
            <button
              onTouchStart={() => window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW', key: 'w' }))}
              onTouchEnd={() => window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyW', key: 'w' }))}
              className="w-14 h-14 bg-emerald-700/90 border border-emerald-400/40 rounded-2xl flex items-center justify-center text-xl font-black text-white active:bg-emerald-500 active:scale-95 shadow-xl"
            >
              ▲
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ── 7. RESULTS MODAL VIEW ─────────────────────────────────
  const renderResults = () => {
    const res = lastMatchResult;
    if (!res) return null;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-md w-full bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-6 text-center shadow-2xl my-auto"
        >
          <div className="space-y-2">
            <div className="text-5xl">{res.isWin ? '🏆' : '💥'}</div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wide">
              {res.isWin ? 'DERBY VICTORY!' : 'DERBY MATCH ENDED'}
            </h2>
            <div className="inline-block px-3.5 py-1 bg-amber-500/20 text-amber-400 font-black text-sm rounded-full border border-amber-500/30">
              PLACEMENT: #{res.rank}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">TOTAL SCORE</div>
              <div className="text-xl font-extrabold text-emerald-400 tabular-nums">{res.score.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">ELIMINATIONS</div>
              <div className="text-xl font-extrabold text-amber-400 tabular-nums">{res.eliminations} KILLS</div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-[10px] text-gray-400 uppercase font-bold">DAMAGE DEALT</div>
              <div className="text-sm font-bold text-white tabular-nums">{res.damageDealt} HP</div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-[10px] text-gray-400 uppercase font-bold">SURVIVAL TIME</div>
              <div className="text-sm font-bold text-white tabular-nums">{res.survivalTime}s</div>
            </div>
          </div>

          <div className="flex items-center justify-around bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 text-amber-400 font-extrabold text-sm">
            <div className="flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              <span>+{res.coinsEarned} COINS</span>
            </div>
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Sparkles className="w-4 h-4" />
              <span>+{res.xpEarned} XP</span>
            </div>
          </div>

          {res.newArenaUnlocked && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-300 font-extrabold text-xs">
              🎉 NEW ARENA UNLOCKED: {ARENAS[res.newArenaUnlocked]?.name.toUpperCase()}!
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => {
                handlePlaySound('click');
                setMatchTimerSeconds(0);
                setCurrentScore(0);
                setCurrentCombo(0);
                setGameSessionKey((prev) => prev + 1);
                setActiveView('GAMEPLAY');
              }}
              className="w-full py-3 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 text-white font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <span>REPLAY</span>
            </button>

            <button
              onClick={() => {
                handlePlaySound('click');
                const nextIndex = (currentArenaDef?.index || 1) % Object.keys(ARENAS).length + 1;
                const nextArenaObj = Object.values(ARENAS).find((a) => a.index === nextIndex) || ARENAS.arena_1;
                selectArena(nextArenaObj.id);
                setMatchTimerSeconds(0);
                setCurrentScore(0);
                setCurrentCombo(0);
                setGameSessionKey((prev) => prev + 1);
                setActiveView('GAMEPLAY');
              }}
              className="w-full py-3 bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 text-white font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer flex items-center justify-center gap-2"
            >
              <ChevronRight className="w-4 h-4" />
              <span>NEXT ARENA</span>
            </button>

            <button
              onClick={() => {
                handlePlaySound('click');
                setActiveView('MENU');
              }}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs rounded-xl cursor-pointer"
            >
              MAIN MENU
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  return (
    <div className="relative w-full h-screen bg-neutral-950 flex flex-col font-sans select-none overflow-hidden text-white">
      {renderNavbar()}

      <div className="flex-1 flex flex-col relative overflow-hidden">
        {activeView === 'MENU' && renderMenu()}
        {activeView === 'SOLO_DIFFICULTY' && renderSoloDifficulty()}
        {activeView === 'ARENA_SELECT' && renderArenaSelect()}
        {activeView === 'GARAGE' && renderGarage()}
        {activeView === 'MULTIPLAYER_LOBBY' && renderMultiplayerLobby()}
        {activeView === 'RESULTS' && renderResults()}

        {activeView === 'GAMEPLAY' && (
          <div className="relative w-full h-full">
            <DemolitionDerbyCanvas
              key={`canvas_session_${gameSessionKey}`}
              arenaId={currentArena}
              difficulty={selectedDifficulty}
              playerVehicleId={selectedVehicle}
              playerUpgrades={vehicleUpgrades[selectedVehicle]}
              isMultiplayer={isMultiplayer}
              localUserId={userId}
              localNickname={nickname}
              onMatchComplete={handleMatchComplete}
              onHudUpdate={handleHudUpdate}
              onTransformSync={(data) => {
                if (roomState) sendTransformUpdate(roomState.id, userId, data);
              }}
            />
            {renderGameplayHud()}
          </div>
        )}
      </div>
    </div>
  );
}

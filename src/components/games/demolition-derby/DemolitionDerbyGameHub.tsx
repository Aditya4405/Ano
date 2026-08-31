'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
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
import { socketService } from '@/lib/socket';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Vehicle3DTurntablePreview } from './Vehicle3DTurntablePreview';
import { preloadAllDerbyGLTFModels } from './Derby3DVehicleBuilder';
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
  Shield,
  Zap,
  Gauge,
  Wrench,
} from 'lucide-react';

type ActiveView =
  | 'MENU'
  | 'ARENA_SELECT'
  | 'GARAGE'
  | 'MULTIPLAYER_LOBBY'
  | 'GAMEPLAY'
  | 'RESULTS';

export function DemolitionDerbyGameHub() {
  const searchParams = useSearchParams();
  const roomCodeParam = searchParams?.get('room');

  const userStoreId = useUserStore((s) => s.id);
  const userStoreNickname = useUserStore((s) => s.nickname);
  const login = useUserStore((s) => s.login);

  // Auto-initialize anonymous guest user if not logged in
  useEffect(() => {
    if (!userStoreId) {
      login('Racer_' + Math.floor(1000 + Math.random() * 9000));
    }
  }, [userStoreId, login]);

  const userId = userStoreId || 'guest';
  const nickname = userStoreNickname || 'Player';

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
    multiplayerResults,
    availableLobbies,
    isCreatingLobby,
    lobbyError,
    matchAliveCount,
    matchTotalPlayers,
    selectVehicle,
    unlockVehicle,
    upgradeVehicleStat,
    selectArena,
    recordMatchResult,
    toggleSound,
    initLobbySockets,
    fetchLobbies,
    clearLobbyError,
    createLobby,
    joinLobby,
    toggleReady,
    startMatch,
    leaveLobby,
    sendSelectCar,
    sendSelectArena,
    sendTransformUpdate,
  } = useDemolitionDerbyStore();

  const [activeView, setActiveView] = useState<ActiveView>('MENU');
  const [directCode, setDirectCode] = useState<string>('');
  const [previewCarId, setPreviewCarId] = useState<VehicleId>(selectedVehicle || 'road_crusher');
  const [isHostArenaModalOpen, setIsHostArenaModalOpen] = useState(false);
  const [isLobbyGarageModalOpen, setIsLobbyGarageModalOpen] = useState(false);

  useEffect(() => {
    setPreviewCarId(selectedVehicle);
  }, [selectedVehicle]);

  // HUD Metrics
  const [playerHp, setPlayerHp] = useState(100);
  const [currentScore, setCurrentScore] = useState(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const [opponentsRemaining, setOpponentsRemaining] = useState(2);
  const [totalCombatantsCount, setTotalCombatantsCount] = useState(2);
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

  // Frozen arena ID — locked when GAMEPLAY starts, never changed mid-match
  const frozenArenaRef = useRef<ArenaId>(currentArena);

  useEffect(() => {
    preloadAllDerbyGLTFModels();
  }, []);

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
      joinLobby(roomCodeParam, userId, nickname);
    }
  }, [roomCodeParam, userId, nickname, roomState, joinLobby]);

  // Room State Sync — transitions view based on authoritative server status
  useEffect(() => {
    if (roomState) {
      if (roomState.status === 'PLAYING' || roomState.status === 'COUNTDOWN') {
        if (activeView !== 'GAMEPLAY') {
          const serverArenaId = roomState.settings?.arenaId as ArenaId | undefined;
          if (serverArenaId) frozenArenaRef.current = serverArenaId;
          setActiveView('GAMEPLAY');
        }
      } else if (roomState.status === 'LOBBY' || (roomState.status as string) === 'WAITING') {
        if (activeView !== 'MULTIPLAYER_LOBBY') {
          setActiveView('MULTIPLAYER_LOBBY');
        }
      } else if (roomState.status === 'FINISHED') {
        if (activeView !== 'RESULTS') {
          setActiveView('RESULTS');
        }
      }
    }
  }, [roomState, activeView]);

  const handlePlaySound = (type: string) => {
    if (type === 'click') derbySoundSystem.playClick();
  };

  const handleHudUpdate = useCallback(
    (hp: number, score: number, combo: number, opponentsAlive: number, timerSec: number, totalCombatants: number = 2) => {
      setPlayerHp(hp);
      setCurrentScore(score);
      setCurrentCombo(combo);
      setOpponentsRemaining(opponentsAlive);
      setTotalCombatantsCount(totalCombatants);
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
              Real-Time Multiplayer Derby
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
    <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
      <div className="max-w-xl w-full space-y-8 my-auto text-center">
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest">
            <Flame className="w-4 h-4 text-amber-500" /> Real-Time Multiplayer Derby
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white uppercase italic">
            Ano <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-red-500 to-amber-600">Demolition Derby</span>
          </h1>
          <p className="text-gray-400 text-sm md:text-base max-w-md mx-auto">
            Real-time multiplayer demolition combat! Crash into opponent cars, deal high-impact collision damage, and survive as the last driver standing.
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
              setActiveView('MULTIPLAYER_LOBBY');
            }}
            className="w-full py-4 bg-gradient-to-r from-amber-500 via-red-600 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-lg uppercase tracking-wider rounded-2xl transition-all shadow-xl shadow-amber-500/25 flex items-center justify-center gap-3 cursor-pointer group hover:scale-[1.02]"
          >
            <Users className="w-6 h-6 text-white" />
            <span>ENTER MULTIPLAYER LOBBY</span>
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

  // ── 2. ARENA SELECTION MAP ────────────────────────────────
  const renderArenaSelect = () => (
    <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-w-5xl mx-auto w-full">
      <div className="text-center space-y-2 mb-6">
        <h2 className="text-3xl font-black text-white uppercase tracking-wide">BATTLE ARENAS</h2>
        <p className="text-gray-400 text-xs md:text-sm">Select from 7 tactical demolition arenas with distinct surfaces & hazards</p>
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
              className={`p-5 rounded-2xl border transition-all text-left relative overflow-hidden flex flex-col justify-between ${
                isSelected
                  ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/15 ring-2 ring-amber-500/50'
                  : isUnlocked
                  ? 'bg-neutral-900/90 border-white/10 hover:border-white/30 cursor-pointer'
                  : 'bg-neutral-950/80 border-white/5 opacity-50 cursor-not-allowed'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">
                      ARENA {a.index} • {a.difficultyTag.toUpperCase()}
                    </div>
                    <h3 className="text-xl font-black text-white">{a.name}</h3>
                  </div>
                  {isSelected ? (
                    <span className="px-2.5 py-1 bg-amber-500 text-black text-[10px] font-black rounded-lg uppercase tracking-wider">
                      SELECTED
                    </span>
                  ) : isCompleted ? (
                    <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-[10px] font-bold rounded-lg border border-emerald-500/30 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> UNLOCKED
                    </span>
                  ) : !isUnlocked ? (
                    <span className="px-2.5 py-1 bg-zinc-800 text-zinc-400 text-[10px] font-bold rounded-lg border border-zinc-700 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> LOCKED
                    </span>
                  ) : null}
                </div>

                <p className="text-xs text-gray-300 mb-3">{a.description}</p>

                {a.features && (
                  <ul className="space-y-1 mb-4 text-[11px] text-gray-400">
                    {a.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex items-center justify-between text-xs border-t border-white/10 pt-3 mt-auto">
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                    isCompleted ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-400'
                  }`}>
                    {isCompleted ? 'COMPLETED' : 'UNLOCKED'}
                  </span>
                </div>
                {bestScore > 0 ? (
                  <span className="text-amber-400 font-extrabold tabular-nums">Best: {bestScore.toLocaleString()} pts</span>
                ) : (
                  <span className="text-zinc-500 text-[11px]">No Best Score</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // ── 3. GARAGE & 3D VEHICLE SHOWROOM ─────────────────────
  const renderGarage = () => {
    const previewDef = VEHICLES[previewCarId] || VEHICLES.road_crusher;
    const previewStats = computeEffectiveStats(previewCarId);
    const isUnlocked = unlockedVehicles.includes(previewCarId);
    const isEquipped = selectedVehicle === previewCarId;
    const canAfford = coins >= previewDef.price;

    const FOUR_CARS: VehicleId[] = [
      'road_crusher',
      'iron_tanker',
      'apex_phantom',
      'armored_juggernaut',
    ];

    return (
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden max-w-6xl mx-auto w-full space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-4">
          <div>
            <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" /> 3D MULTIPLAYER SHOWROOM
            </div>
            <h2 className="text-3xl font-black text-white uppercase tracking-wide">VEHICLE GARAGE</h2>
            <p className="text-gray-400 text-xs mt-0.5">Select and unlock custom demolition derby battle machines</p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-black shadow-lg">
              <Coins className="w-4 h-4 text-amber-400" />
              <span>{coins.toLocaleString()} POINTS</span>
            </div>

            {roomState && (
              <button
                onClick={() => {
                  handlePlaySound('click');
                  setActiveView('MULTIPLAYER_LOBBY');
                }}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <Users className="w-4 h-4" />
                <span>RETURN TO LOBBY</span>
              </button>
            )}
          </div>
        </div>

        {/* Top 3D Turntable Stage + Specs Dossier */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 bg-neutral-900/90 border border-white/10 rounded-3xl p-5 md:p-6 shadow-2xl backdrop-blur-md">
          {/* Left: 3D Turntable Viewer */}
          <div className="lg:col-span-7 flex flex-col items-center justify-center bg-black/70 border border-white/10 rounded-2xl p-3 relative overflow-hidden min-h-[300px] md:min-h-[360px]">
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
              <span className="px-2.5 py-1 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black rounded-lg uppercase tracking-wider">
                3D TURNTABLE
              </span>
              <span className="text-[10px] text-gray-400 font-bold hidden sm:inline">
                Drag to rotate 360°
              </span>
            </div>

            <div className="w-full h-full min-h-[280px] md:min-h-[340px] flex items-center justify-center">
              <Vehicle3DTurntablePreview
                vehicleId={previewCarId}
                color={previewDef.color}
                accentColor={previewDef.accentColor}
                autoRotate={true}
                className="w-full h-[280px] md:h-[340px]"
              />
            </div>

            <div className="absolute bottom-3 right-3 z-10 text-[10px] text-gray-400 font-mono">
              OBB: {previewDef.length}m × {previewDef.width}m
            </div>
          </div>

          {/* Right: Vehicle Dossier & Action */}
          <div className="lg:col-span-5 flex flex-col justify-between space-y-5 text-left">
            <div className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest">
                    {previewDef.tagline}
                  </div>
                  <h3 className="text-2xl md:text-3xl font-black text-white uppercase">{previewDef.name}</h3>
                </div>

                <div className="text-right">
                  <div className="text-[10px] text-gray-400 uppercase font-bold">UNLOCK COST</div>
                  <div className="text-lg font-black text-amber-400 flex items-center justify-end gap-1">
                    <Coins className="w-4 h-4" />
                    <span>{previewDef.price.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed">{previewDef.description}</p>

              {/* Special Ability Pill */}
              <div className="p-2.5 bg-white/5 border border-white/10 rounded-xl space-y-1">
                <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5" /> COMBAT PROFILE
                </div>
                <div className="text-[11px] text-gray-300">
                  {previewCarId === 'road_crusher' && 'Elongated steel crash ram deals +40% front ramming damage at top speeds.'}
                  {previewCarId === 'iron_tanker' && 'Massive steel armor plating mitigates -35% incoming collision damage.'}
                  {previewCarId === 'apex_phantom' && 'Ultra-high downforce aerodynamics grants agile drifting & sharp corner escapes.'}
                  {previewCarId === 'armored_juggernaut' && 'Bulldozer V-plow front blade with 5 steel spikes pulverizes light opponents.'}
                </div>
              </div>
            </div>

            {/* Stat Bars */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">VEHICLE BASE SPECS</div>

              {[
                { label: 'TOP SPEED', val: previewStats.speed, icon: Gauge, color: 'from-cyan-500 to-blue-500' },
                { label: 'ARMOR DEFENSE', val: previewStats.armor, icon: Shield, color: 'from-emerald-500 to-teal-500' },
                { label: 'RAM POWER', val: previewStats.ram, icon: Flame, color: 'from-amber-500 to-red-500' },
                { label: 'HANDLING / DRIFT', val: previewStats.handling, icon: Zap, color: 'from-purple-500 to-indigo-500' },
              ].map((st) => (
                <div key={st.label} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-white flex items-center gap-1.5 text-[11px]">
                      <st.icon className="w-3.5 h-3.5 text-gray-400" />
                      {st.label}
                    </span>
                    <span className="font-black text-amber-400 text-xs tabular-nums">{st.val} / 100</span>
                  </div>

                  <div className="w-full h-2.5 bg-black/60 rounded-full overflow-hidden border border-white/10 p-0.5">
                    <div
                      className={`h-full bg-gradient-to-r ${st.color} rounded-full transition-all duration-300`}
                      style={{ width: `${Math.min(100, st.val)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons */}
            <div className="pt-2">
              {isEquipped ? (
                <div className="w-full py-3.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-center text-sm uppercase rounded-2xl flex items-center justify-center gap-2 shadow-lg">
                  <CheckCircle2 className="w-5 h-5" />
                  <span>EQUIPPED FOR MULTIPLAYER</span>
                </div>
              ) : isUnlocked ? (
                <button
                  onClick={() => {
                    handlePlaySound('click');
                    selectVehicle(previewCarId, userId);
                  }}
                  className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
                >
                  <Check className="w-5 h-5" />
                  <span>SELECT & EQUIP VEHICLE</span>
                </button>
              ) : (
                <button
                  disabled={!canAfford}
                  onClick={() => {
                    handlePlaySound('click');
                    unlockVehicle(previewCarId, userId);
                  }}
                  className={`w-full py-3.5 font-black text-sm uppercase tracking-wider rounded-2xl shadow-xl transition-all flex items-center justify-center gap-2 ${
                    canAfford
                      ? 'bg-gradient-to-r from-amber-500 via-red-600 to-amber-600 hover:from-amber-400 text-white cursor-pointer hover:scale-[1.02] shadow-amber-500/25'
                      : 'bg-neutral-800 border border-white/10 text-gray-400 cursor-not-allowed opacity-60'
                  }`}
                >
                  <Coins className="w-5 h-5 text-amber-400" />
                  <span>
                    {canAfford
                      ? `UNLOCK FOR ${previewDef.price.toLocaleString()} POINTS`
                      : `NEED ${(previewDef.price - coins).toLocaleString()} MORE POINTS`}
                  </span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bottom 4 Car Cards Grid */}
        <div className="space-y-3 text-left">
          <div className="text-xs font-black text-gray-400 uppercase tracking-widest">
            AVAILABLE VEHICLES (4 CHOICES)
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {FOUR_CARS.map((cId) => {
              const def = VEHICLES[cId];
              const isCardUnlocked = unlockedVehicles.includes(cId);
              const isCardEquipped = selectedVehicle === cId;
              const isCardActivePreview = previewCarId === cId;
              const stats = computeEffectiveStats(cId);

              return (
                <div
                  key={cId}
                  onClick={() => {
                    handlePlaySound('click');
                    setPreviewCarId(cId);
                  }}
                  className={`p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
                    isCardActivePreview
                      ? 'bg-amber-500/10 border-amber-500 shadow-xl shadow-amber-500/20 ring-2 ring-amber-500/40'
                      : isCardEquipped
                      ? 'bg-emerald-500/10 border-emerald-500/60'
                      : isCardUnlocked
                      ? 'bg-neutral-900/90 border-white/10 hover:border-white/30'
                      : 'bg-neutral-950/80 border-white/5 opacity-80 hover:opacity-100 hover:border-white/20'
                  }`}
                >
                  {/* Status Badges */}
                  <div className="flex justify-between items-start mb-2">
                    <div className="w-3.5 h-3.5 rounded-full border border-white/20" style={{ backgroundColor: def.color }} />

                    {isCardEquipped ? (
                      <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-400 text-[10px] font-black rounded-md border border-emerald-500/40">
                        EQUIPPED
                      </span>
                    ) : isCardUnlocked ? (
                      <span className="px-2 py-0.5 bg-white/10 text-gray-300 text-[10px] font-bold rounded-md">
                        UNLOCKED
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded-md border border-amber-500/30 flex items-center gap-1">
                        <Coins className="w-3 h-3" /> {def.price}
                      </span>
                    )}
                  </div>

                  {/* Thumbnail / Title */}
                  <div className="space-y-1 mb-3">
                    <div className="text-[10px] text-amber-400 font-bold uppercase tracking-wider truncate">
                      {def.tagline}
                    </div>
                    <h4 className="text-lg font-black text-white leading-tight uppercase">{def.name}</h4>
                  </div>

                  {/* Stat Snippets */}
                  <div className="grid grid-cols-2 gap-1.5 text-[10px] text-gray-300 bg-black/40 p-2 rounded-xl border border-white/5 mb-3">
                    <div>SPEED: <span className="font-bold text-cyan-400">{stats.speed}</span></div>
                    <div>ARMOR: <span className="font-bold text-emerald-400">{stats.armor}</span></div>
                    <div>RAM: <span className="font-bold text-red-400">{stats.ram}</span></div>
                    <div>DRIFT: <span className="font-bold text-purple-400">{stats.handling}</span></div>
                  </div>

                  {/* Card Select Button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlaySound('click');
                      if (isCardUnlocked) {
                        selectVehicle(cId, userId);
                      } else {
                        setPreviewCarId(cId);
                      }
                    }}
                    className={`w-full py-2 rounded-xl text-xs font-black uppercase transition-colors ${
                      isCardEquipped
                        ? 'bg-emerald-600 text-white cursor-default'
                        : isCardUnlocked
                        ? 'bg-amber-500 hover:bg-amber-400 text-black cursor-pointer'
                        : 'bg-white/10 hover:bg-white/20 text-amber-400 cursor-pointer'
                    }`}
                  >
                    {isCardEquipped ? 'EQUIPPED' : isCardUnlocked ? 'SELECT' : 'INSPECT & UNLOCK'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── 4. MULTIPLAYER LOBBY ──────────────────────────────────
  const renderMultiplayerLobby = () => {
    const isHost = Boolean(
      roomState && (
        roomState.hostId === userId ||
        roomState.players.find((p) => p.userId === userId)?.role === 'HOST'
      )
    );
    const hasMinPlayers = (roomState?.players?.length || 0) >= 2;
    const allPlayersReady = roomState?.players?.every((p) => p.role === 'HOST' || p.isReady) ?? false;
    const canStart = isHost && hasMinPlayers && allPlayersReady;
    const currentLobbyArena = ARENAS[roomState?.settings?.arenaId || currentArena] || ARENAS.arena_1;

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        <div className="max-w-xl w-full space-y-6 my-auto text-center">
          {lobbyError && (
            <div className="p-3 bg-red-500/20 border border-red-500/40 rounded-xl text-red-300 text-xs font-bold flex items-center justify-between">
              <span>{lobbyError}</span>
              <button onClick={clearLobbyError} className="text-red-400 hover:text-white font-bold ml-2">✕</button>
            </div>
          )}

          {!roomState ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-xs font-bold uppercase tracking-widest">
                  <Flame className="w-3.5 h-3.5" /> MULTIPLAYER ARENA
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-wide">
                  DEMOLITION DERBY
                </h2>
                <p className="text-gray-400 text-xs md:text-sm">
                  Create a battle room or join friends to compete in real-time destruction
                </p>
              </div>

              {/* Equipped Car Mini Banner */}
              <div className="flex items-center justify-between p-3.5 bg-neutral-900 border border-white/10 rounded-2xl text-left">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 rounded-full border border-white/20" style={{ backgroundColor: selectedVehicleDef.color }} />
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase font-bold">Equipped Car</div>
                    <div className="text-sm font-black text-white">{selectedVehicleDef.name}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    handlePlaySound('click');
                    setActiveView('GARAGE');
                  }}
                  className="px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/10 text-xs font-bold text-amber-400 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>CHANGE CAR</span>
                </button>
              </div>

              <button
                disabled={isCreatingLobby}
                onClick={() => {
                  handlePlaySound('click');
                  createLobby(userId, nickname, currentArena);
                }}
                className={`w-full py-4 bg-gradient-to-r from-amber-500 via-red-600 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-white font-black text-base uppercase tracking-wider rounded-2xl shadow-xl flex items-center justify-center gap-2 transition-all ${
                  isCreatingLobby ? 'opacity-70 cursor-wait' : 'cursor-pointer hover:scale-[1.02]'
                }`}
              >
                {isCreatingLobby ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Play className="w-5 h-5 fill-white" />
                )}
                <span>{isCreatingLobby ? 'CREATING ROOM...' : 'CREATE MATCH ROOM'}</span>
              </button>

              {/* Direct Room Code Join */}
              <div className="p-4 bg-neutral-900/90 border border-white/10 rounded-2xl space-y-2 text-left">
                <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">JOIN BY ROOM CODE / LINK</div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste Game ID or Code..."
                    value={directCode}
                    onChange={(e) => setDirectCode(e.target.value)}
                    className="flex-1 px-3 py-2 bg-neutral-950 border border-white/10 rounded-xl text-white text-xs font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <button
                    disabled={!directCode.trim()}
                    onClick={() => {
                      if (directCode.trim()) {
                        handlePlaySound('click');
                        joinLobby(directCode.trim(), userId, nickname);
                      }
                    }}
                    className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl cursor-pointer"
                  >
                    JOIN
                  </button>
                </div>
              </div>

              {/* Available Lobbies */}
              <div className="space-y-2 pt-2 text-left">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">AVAILABLE LOBBIES</div>
                  <button
                    onClick={fetchLobbies}
                    className="text-[10px] text-cyan-400 hover:underline font-bold"
                  >
                    REFRESH
                  </button>
                </div>
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
                        <div className="text-[10px] text-gray-400">{l.players?.length || l.playerCount || 1} / {l.maxPlayers || 8} Players</div>
                      </div>
                      <button
                        onClick={() => {
                          handlePlaySound('click');
                          joinLobby(l.id, userId, nickname);
                        }}
                        className="px-3.5 py-1.5 bg-cyan-500 text-white font-bold text-xs rounded-lg hover:bg-cyan-400 cursor-pointer"
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
              {/* Lobby Header */}
              <div className="flex justify-between items-center border-b border-white/10 pb-3">
                <div>
                  <div className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider">MATCH LOBBY</div>
                  <h3 className="text-xl font-black text-white">DEMOLITION DERBY</h3>
                  <div className="text-[10px] text-gray-400 font-mono mt-0.5">ID: {roomState.id}</div>
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

              {/* Host-Only Arena Selector Banner */}
              <div className="p-4 bg-black/50 border border-white/10 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <div className="text-[10px] text-amber-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5" /> BATTLE ARENA
                  </div>
                  <div className="text-base font-black text-white mt-0.5">{currentLobbyArena.name}</div>
                  <div className="text-[11px] text-gray-400">{currentLobbyArena.difficultyTag} • 100% Unlocked</div>
                </div>

                {isHost ? (
                  <button
                    onClick={() => setIsHostArenaModalOpen(true)}
                    className="px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-md"
                  >
                    <Compass className="w-3.5 h-3.5" />
                    <span>CHANGE ARENA</span>
                  </button>
                ) : (
                  <span className="px-2.5 py-1 bg-white/5 border border-white/10 text-gray-400 text-[10px] font-bold rounded-lg flex items-center gap-1">
                    <Lock className="w-3 h-3 text-gray-400" /> Selected by Host
                  </span>
                )}
              </div>

              {/* Players in Lobby with Selected Vehicle Badges */}
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    PLAYERS IN LOBBY ({roomState.players.length} / {roomState.settings?.maxPlayers || 8})
                  </div>

                  <button
                    onClick={() => {
                      handlePlaySound('click');
                      setPreviewCarId(selectedVehicle);
                      setIsLobbyGarageModalOpen(true);
                    }}
                    className="text-[11px] font-bold text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3 h-3" />
                    <span>GARAGE (SELECT CAR)</span>
                  </button>
                </div>

                {roomState.players.map((p) => {
                  const pVehicleKey = (p.selectedCarId || (p as any).vehicleId || 'road_crusher') as VehicleId;
                  const pCarDef = VEHICLES[pVehicleKey] || VEHICLES.road_crusher;

                  return (
                    <div
                      key={p.userId}
                      className="p-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-between text-sm font-bold text-white"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: pCarDef.color }} />
                        <span>{p.nickname}</span>

                        {p.role === 'HOST' && (
                          <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[9px] rounded font-bold">
                            HOST
                          </span>
                        )}
                        {p.userId === userId && (
                          <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-[9px] rounded font-bold">
                            YOU
                          </span>
                        )}

                        <span className="text-[11px] text-amber-300 font-extrabold bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                          {pCarDef.name}
                        </span>
                      </div>

                      <span className={p.isReady ? 'text-emerald-400 text-xs font-extrabold' : 'text-amber-400 text-xs font-bold'}>
                        {p.isReady ? 'READY' : 'NOT READY'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Lobby Action Controls */}
              <div className="pt-2 space-y-2">
                {isHost ? (
                  <div className="space-y-1">
                    <button
                      disabled={!canStart}
                      onClick={() => {
                        handlePlaySound('click');
                        startMatch(roomState.id, roomState.hostId || userId);
                      }}
                      className={`w-full py-3.5 font-black text-sm uppercase rounded-xl shadow-lg transition-all ${
                        canStart
                          ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 text-white cursor-pointer hover:scale-[1.02]'
                          : 'bg-neutral-800 border border-white/10 text-gray-400 cursor-not-allowed opacity-75'
                      }`}
                    >
                      {!hasMinPlayers
                        ? `WAITING FOR PLAYERS (${roomState.players.length} / 2 MIN)`
                        : !allPlayersReady
                        ? 'WAITING FOR PLAYERS TO BE READY'
                        : 'START MATCH'}
                    </button>
                    {!hasMinPlayers && (
                      <p className="text-[11px] text-amber-400/90 text-center font-semibold">
                        At least 2 players are required to start.
                      </p>
                    )}
                  </div>
                ) : (
                  (() => {
                    const localPlayer = roomState.players.find((p) => p.userId === userId);
                    return (
                      <button
                        onClick={() => {
                          toggleReady(roomState.id, userId, !localPlayer?.isReady);
                        }}
                        className={`w-full py-3.5 font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer transition-all ${
                          localPlayer?.isReady
                            ? 'bg-amber-600 hover:bg-amber-500 text-white'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 text-white'
                        }`}
                      >
                        {localPlayer?.isReady ? 'CANCEL READY' : 'READY UP'}
                      </button>
                    );
                  })()
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

          {/* Host Arena Selection Modal */}
          {isHostArenaModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-neutral-900 border border-white/20 rounded-3xl p-6 max-w-2xl w-full max-h-[85vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-4 text-left shadow-2xl">
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <h3 className="text-xl font-black text-white uppercase">SELECT MATCH ARENA</h3>
                    <p className="text-xs text-gray-400">All 7 arenas are 100% unlocked for host selection</p>
                  </div>
                  <button
                    onClick={() => setIsHostArenaModalOpen(false)}
                    className="text-gray-400 hover:text-white font-bold text-lg cursor-pointer px-2"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Object.values(ARENAS).map((a) => {
                    const isSelected = (roomState?.settings?.arenaId || currentArena) === a.id;

                    return (
                      <div
                        key={a.id}
                        onClick={() => {
                          handlePlaySound('click');
                          selectArena(a.id);
                          if (roomState) {
                            sendSelectArena(roomState.id, userId, a.id);
                          }
                          setIsHostArenaModalOpen(false);
                        }}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left ${
                          isSelected
                            ? 'bg-amber-500/20 border-amber-500 shadow-md ring-1 ring-amber-500'
                            : 'bg-black/40 border-white/10 hover:border-white/30'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-1">
                          <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-wider">
                            ARENA {a.index} • {a.difficultyTag}
                          </div>
                          {isSelected && (
                            <span className="px-1.5 py-0.5 bg-amber-500 text-black text-[9px] font-black rounded">
                              SELECTED
                            </span>
                          )}
                        </div>
                        <h4 className="text-sm font-black text-white">{a.name}</h4>
                        <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{a.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* In-Lobby Garage & Vehicle Selection Modal */}
          {isLobbyGarageModalOpen && (
            <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-3 md:p-6 select-none">
              <div className="bg-neutral-900 border border-white/20 rounded-3xl p-5 md:p-6 max-w-5xl w-full max-h-[92vh] overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden space-y-5 text-left shadow-2xl">
                {/* Modal Header */}
                <div className="flex justify-between items-center border-b border-white/10 pb-3">
                  <div>
                    <div className="text-[10px] text-amber-400 font-extrabold uppercase tracking-widest flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5" /> MULTIPLAYER VEHICLE SELECTION
                    </div>
                    <h3 className="text-2xl font-black text-white uppercase">GARAGE SHOWROOM</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-xs font-black">
                      <Coins className="w-3.5 h-3.5 text-amber-400" />
                      <span>{coins.toLocaleString()} PTS</span>
                    </div>
                    <button
                      onClick={() => setIsLobbyGarageModalOpen(false)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white text-xs font-bold rounded-xl cursor-pointer"
                    >
                      ✕ CLOSE
                    </button>
                  </div>
                </div>

                {/* 3D Turntable + Dossier */}
                {(() => {
                  const modalPreviewDef = VEHICLES[previewCarId] || VEHICLES.road_crusher;
                  const modalStats = computeEffectiveStats(previewCarId);
                  const isModalUnlocked = unlockedVehicles.includes(previewCarId);
                  const isModalEquipped = selectedVehicle === previewCarId;
                  const canModalAfford = coins >= modalPreviewDef.price;
                  const FOUR_CARS: VehicleId[] = ['road_crusher', 'iron_tanker', 'apex_phantom', 'armored_juggernaut'];

                  return (
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-black/60 border border-white/10 rounded-2xl p-4 md:p-5">
                        {/* 3D Viewer */}
                        <div className="lg:col-span-7 flex flex-col items-center justify-center bg-black/80 border border-white/10 rounded-xl p-2 min-h-[260px] md:min-h-[300px]">
                          <Vehicle3DTurntablePreview
                            vehicleId={previewCarId}
                            color={modalPreviewDef.color}
                            accentColor={modalPreviewDef.accentColor}
                            autoRotate={true}
                            className="w-full h-[260px] md:h-[300px]"
                          />
                        </div>

                        {/* Dossier */}
                        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
                          <div className="space-y-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="text-[10px] text-amber-400 font-extrabold uppercase">{modalPreviewDef.tagline}</div>
                                <h4 className="text-2xl font-black text-white uppercase">{modalPreviewDef.name}</h4>
                              </div>
                              <div className="text-right">
                                <div className="text-[10px] text-gray-400 uppercase font-bold">COST</div>
                                <div className="text-base font-black text-amber-400 flex items-center justify-end gap-1">
                                  <Coins className="w-3.5 h-3.5" />
                                  <span>{modalPreviewDef.price.toLocaleString()}</span>
                                </div>
                              </div>
                            </div>

                            <p className="text-xs text-gray-300 leading-relaxed">{modalPreviewDef.description}</p>
                          </div>

                          {/* Stats */}
                          <div className="space-y-2">
                            {[
                              { label: 'TOP SPEED', val: modalStats.speed, icon: Gauge, color: 'from-cyan-500 to-blue-500' },
                              { label: 'ARMOR DEFENSE', val: modalStats.armor, icon: Shield, color: 'from-emerald-500 to-teal-500' },
                              { label: 'RAM POWER', val: modalStats.ram, icon: Flame, color: 'from-amber-500 to-red-500' },
                              { label: 'HANDLING / DRIFT', val: modalStats.handling, icon: Zap, color: 'from-purple-500 to-indigo-500' },
                            ].map((st) => (
                              <div key={st.label} className="space-y-0.5">
                                <div className="flex justify-between items-center text-[11px]">
                                  <span className="font-bold text-white flex items-center gap-1">
                                    <st.icon className="w-3 h-3 text-gray-400" /> {st.label}
                                  </span>
                                  <span className="font-bold text-amber-400 tabular-nums">{st.val} / 100</span>
                                </div>
                                <div className="w-full h-2 bg-neutral-900 rounded-full overflow-hidden border border-white/10 p-0.5">
                                  <div
                                    className={`h-full bg-gradient-to-r ${st.color} rounded-full`}
                                    style={{ width: `${Math.min(100, st.val)}%` }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>

                          {/* Equip / Unlock Button */}
                          <div>
                            {isModalEquipped ? (
                              <div className="w-full py-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 font-black text-center text-xs uppercase rounded-xl flex items-center justify-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4" />
                                <span>EQUIPPED IN LOBBY</span>
                              </div>
                            ) : isModalUnlocked ? (
                              <button
                                onClick={() => {
                                  handlePlaySound('click');
                                  selectVehicle(previewCarId, userId);
                                  if (roomState) {
                                    sendSelectCar(roomState.id, userId, previewCarId);
                                  }
                                  setIsLobbyGarageModalOpen(false);
                                }}
                                className="w-full py-3 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02]"
                              >
                                <Check className="w-4 h-4" />
                                <span>SELECT & EQUIP FOR LOBBY</span>
                              </button>
                            ) : (
                              <button
                                disabled={!canModalAfford}
                                onClick={() => {
                                  handlePlaySound('click');
                                  if (unlockVehicle(previewCarId, userId)) {
                                    if (roomState) {
                                      sendSelectCar(roomState.id, userId, previewCarId);
                                    }
                                  }
                                }}
                                className={`w-full py-3 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 ${
                                  canModalAfford
                                    ? 'bg-gradient-to-r from-amber-500 via-red-600 to-amber-600 hover:from-amber-400 text-white cursor-pointer hover:scale-[1.02]'
                                    : 'bg-neutral-800 border border-white/10 text-gray-400 cursor-not-allowed opacity-60'
                                }`}
                              >
                                <Coins className="w-4 h-4 text-amber-400" />
                                <span>
                                  {canModalAfford
                                    ? `UNLOCK FOR ${modalPreviewDef.price.toLocaleString()} POINTS`
                                    : `NEED ${(modalPreviewDef.price - coins).toLocaleString()} MORE POINTS`}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 4 Car Choices */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {FOUR_CARS.map((cId) => {
                          const def = VEHICLES[cId];
                          const isCardUnlocked = unlockedVehicles.includes(cId);
                          const isCardEquipped = selectedVehicle === cId;
                          const isCardActivePreview = previewCarId === cId;

                          return (
                            <div
                              key={cId}
                              onClick={() => {
                                handlePlaySound('click');
                                setPreviewCarId(cId);
                              }}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                                isCardActivePreview
                                  ? 'bg-amber-500/15 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                                  : isCardEquipped
                                  ? 'bg-emerald-500/10 border-emerald-500/60'
                                  : isCardUnlocked
                                  ? 'bg-black/40 border-white/10 hover:border-white/30'
                                  : 'bg-black/60 border-white/5 opacity-70 hover:opacity-90'
                              }`}
                            >
                              <div className="flex justify-between items-start mb-1.5">
                                <div className="w-3 h-3 rounded-full border border-white/30" style={{ backgroundColor: def.color }} />
                                {isCardEquipped ? (
                                  <span className="px-1.5 py-0.5 bg-emerald-500/20 text-emerald-400 text-[9px] font-black rounded">
                                    EQUIPPED
                                  </span>
                                ) : isCardUnlocked ? (
                                  <span className="px-1.5 py-0.5 bg-white/10 text-gray-300 text-[9px] font-bold rounded">
                                    UNLOCKED
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-300 text-[9px] font-bold rounded flex items-center gap-0.5">
                                    <Coins className="w-2.5 h-2.5" /> {def.price}
                                  </span>
                                )}
                              </div>
                              <div className="font-extrabold text-white text-xs uppercase leading-tight">{def.name}</div>
                              <div className="text-[10px] text-gray-400 truncate mt-0.5">{def.tagline}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // ── 5. COMPACT GAMEPLAY HUD OVERLAY ────────────────────────
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
            {opponentsRemaining} / {totalCombatantsCount} ALIVE
          </div>
        </div>
      </div>

      {/* Bottom Controls Overlay */}
      <div className="flex justify-between items-end pb-1 pointer-events-none">
        {/* Desktop Hint */}
        <div className="hidden md:block text-[10px] font-bold text-gray-400 bg-neutral-900/90 border border-white/10 px-3 py-1.5 rounded-lg backdrop-blur-md">
          WASD / ARROWS — DRIVE • SPACE — DRIFT
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

  // ── 6. RESULTS / WINNER POPUP VIEW ─────────────────────────────
  const renderResults = () => {
    const res = lastMatchResult;
    const mpResults = multiplayerResults;
    const myMpResult = mpResults?.find((r) => r.userId === userId || r.playerId === userId);

    const effectiveRes = res ?? (myMpResult ? {
      rank: myMpResult.rank,
      score: myMpResult.score,
      eliminations: myMpResult.eliminations,
      damageDealt: myMpResult.damageDealt || 0,
      survivalTime: myMpResult.survivalTime || 0,
      isWin: myMpResult.rank === 1,
      coinsEarned: 0,
      xpEarned: 0,
      newArenaUnlocked: null,
    } : null);

    if (!effectiveRes) return null;

    const winner = mpResults?.find((r) => r.rank === 1);
    const winnerName = winner ? (winner.nickname || winner.name || 'SURVIVOR') : (effectiveRes.isWin ? nickname : 'OPPONENT');
    const isLocalWinner = effectiveRes.isWin || (winner && (winner.userId === userId || winner.playerId === userId));

    return (
      <div className="flex-1 flex flex-col items-center justify-center p-4 md:p-6 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden relative z-30">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="max-w-lg w-full bg-neutral-900 border border-white/10 rounded-3xl p-6 space-y-5 text-center shadow-2xl my-auto"
        >
          <div className="space-y-2">
            <div className="text-6xl">🏆</div>
            <div className="text-xs font-black text-amber-400 uppercase tracking-widest">
              MATCH OVER
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tight">
              {winnerName}
            </h2>
            <div className="text-lg font-black text-emerald-400 uppercase tracking-wider">
              SURVIVED!
            </div>
            <div className="inline-block px-4 py-1 bg-amber-500/20 text-amber-400 font-black text-xs rounded-full border border-amber-500/40 uppercase tracking-widest">
              WINNER
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-left">
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">YOUR PLACEMENT</div>
              <div className="text-xl font-extrabold text-amber-400 tabular-nums">#{effectiveRes.rank} / {totalCombatantsCount}</div>
            </div>
            <div>
              <div className="text-[10px] text-gray-400 uppercase font-bold">TOTAL SCORE</div>
              <div className="text-xl font-extrabold text-emerald-400 tabular-nums">{effectiveRes.score.toLocaleString()}</div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-[10px] text-gray-400 uppercase font-bold">ELIMINATIONS</div>
              <div className="text-sm font-bold text-white tabular-nums">{effectiveRes.eliminations} Kills</div>
            </div>
            <div className="pt-2 border-t border-white/10">
              <div className="text-[10px] text-gray-400 uppercase font-bold">DAMAGE DEALT</div>
              <div className="text-sm font-bold text-white tabular-nums">{effectiveRes.damageDealt} HP</div>
            </div>
          </div>

          {/* Multiplayer Combatants Leaderboard */}
          {multiplayerResults && multiplayerResults.length > 0 && (
            <div className="bg-white/5 border border-white/10 rounded-2xl p-3 text-left space-y-2">
              <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider px-1">
                MATCH LEADERBOARD
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto">
                {multiplayerResults.map((r) => (
                  <div
                    key={r.userId || r.playerId}
                    className={`flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-bold ${
                      (r.userId === userId || r.playerId === userId)
                        ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300'
                        : 'bg-white/5 text-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-amber-400 font-extrabold">#{r.rank}</span>
                      <span>{r.nickname || r.name}</span>
                      {(r.userId === userId || r.playerId === userId) && <span className="text-[9px] text-amber-400 bg-amber-500/30 px-1 rounded">YOU</span>}
                      {r.rank === 1 && <span className="text-[10px]">👑</span>}
                    </div>
                    <div className="flex items-center gap-3 tabular-nums text-[11px]">
                      <span className="text-gray-400">{r.eliminations} Kills</span>
                      <span className="text-emerald-400 font-extrabold">{r.score.toLocaleString()} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              onClick={() => {
                handlePlaySound('click');
                setLastMatchResult(null);
                setPlayerHp(100);
                setCurrentScore(0);
                setGameSessionKey((k) => k + 1);
                if (roomState) {
                  const socket = socketService.getSocket();
                  if (socket) socket.emit('derby_reset_lobby', { gameId: roomState.id });
                }
                setActiveView('MULTIPLAYER_LOBBY');
              }}
              className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-red-600 hover:from-amber-400 hover:to-red-500 text-white font-black text-sm uppercase rounded-xl shadow-lg cursor-pointer transition-all hover:scale-[1.02]"
            >
              RETURN TO DERBY LOBBY
            </button>

            <button
              onClick={() => {
                handlePlaySound('click');
                leaveLobby(userId);
                setActiveView('MENU');
              }}
              className="w-full py-2.5 bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white font-bold text-xs uppercase rounded-xl cursor-pointer transition-all"
            >
              LEAVE ROOM & RETURN TO MENU
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
        {activeView === 'ARENA_SELECT' && renderArenaSelect()}
        {activeView === 'GARAGE' && renderGarage()}
        {activeView === 'MULTIPLAYER_LOBBY' && renderMultiplayerLobby()}
        {activeView === 'RESULTS' && renderResults()}

        {activeView === 'GAMEPLAY' && (
          <div className="relative w-full h-full">
            <DemolitionDerbyCanvas
              key={`canvas_${roomState?.id || gameSessionKey}`}
              gameId={roomState?.id}
              arenaId={frozenArenaRef.current || currentArena}
              difficulty={selectedDifficulty}
              playerVehicleId={selectedVehicle}
              playerUpgrades={vehicleUpgrades[selectedVehicle]}
              isMultiplayer={true}
              localUserId={userId}
              localNickname={nickname}
              roomPlayers={roomState?.players}
              serverAliveCount={matchAliveCount}
              serverTotalPlayers={matchTotalPlayers}
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

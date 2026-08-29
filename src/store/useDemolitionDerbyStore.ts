import { create } from 'zustand';
import {
  AIDifficulty,
  ArenaId,
  DerbyRoomState,
  HitNotification,
  MatchResult,
  VehicleId,
  VehicleUpgrades,
} from '@/components/games/demolition-derby/types';
import { socketService } from '@/lib/socket';
import { ARENAS, VEHICLES } from '@/components/games/demolition-derby/DerbyPhysicsEngine';

const STORAGE_KEY = 'ano_demolition_derby_save_v1';

interface DemolitionDerbyState {
  // Solo Campaign & Rewards
  coins: number;
  xp: number;
  unlockedVehicles: VehicleId[];
  selectedVehicle: VehicleId;
  vehicleUpgrades: Record<VehicleId, VehicleUpgrades>;
  unlockedArenas: ArenaId[];
  completedArenas: ArenaId[];
  currentArena: ArenaId;
  bestScores: Record<ArenaId, number>;
  bestSurvivalTimes: Record<ArenaId, number>;
  selectedDifficulty: AIDifficulty;
  soundMuted: boolean;

  // Multiplayer Lobby & Room
  roomState: DerbyRoomState | null;
  availableLobbies: any[];
  multiplayerResults: any[] | null;

  // Actions
  selectVehicle: (id: VehicleId) => void;
  unlockVehicle: (id: VehicleId) => boolean;
  upgradeVehicleStat: (vehicleId: VehicleId, stat: keyof VehicleUpgrades) => boolean;
  selectDifficulty: (diff: AIDifficulty) => void;
  selectArena: (arenaId: ArenaId) => void;
  recordMatchResult: (
    arenaId: ArenaId,
    score: number,
    survivalTime: number,
    eliminations: number,
    isWin: boolean
  ) => { coinsEarned: number; xpEarned: number; newArenaUnlocked: ArenaId | null };
  toggleSound: () => void;

  // Socket Multiplayer
  initLobbySockets: (userId: string) => () => void;
  createLobby: (userId: string, nickname: string, arenaId?: ArenaId) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  startMatch: (gameId: string, hostId: string) => void;
  leaveLobby: (userId: string) => void;
  sendTransformUpdate: (gameId: string, userId: string, data: any) => void;
  sendHitImpact: (gameId: string, userId: string, data: any) => void;
  sendReturnToLobby: (gameId: string, userId: string) => void;
}

const DEFAULT_UPGRADES: VehicleUpgrades = {
  engine: 0,
  armor: 0,
  ram: 0,
  handling: 0,
  brakes: 0,
};

function loadSavedState() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveState(state: any) {
  if (typeof window === 'undefined') return;
  try {
    const dataToSave = {
      coins: state.coins,
      xp: state.xp,
      unlockedVehicles: state.unlockedVehicles,
      selectedVehicle: state.selectedVehicle,
      vehicleUpgrades: state.vehicleUpgrades,
      unlockedArenas: state.unlockedArenas,
      completedArenas: state.completedArenas,
      currentArena: state.currentArena,
      bestScores: state.bestScores,
      bestSurvivalTimes: state.bestSurvivalTimes,
      selectedDifficulty: state.selectedDifficulty,
      soundMuted: state.soundMuted,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (e) {}
}

const saved = loadSavedState();

export const useDemolitionDerbyStore = create<DemolitionDerbyState>((set, get) => ({
  coins: saved?.coins ?? 500,
  xp: saved?.xp ?? 0,
  unlockedVehicles: saved?.unlockedVehicles ?? ['starter'],
  selectedVehicle: saved?.selectedVehicle ?? 'starter',
  vehicleUpgrades: saved?.vehicleUpgrades ?? {
    starter: { ...DEFAULT_UPGRADES },
    muscle: { ...DEFAULT_UPGRADES },
    heavy: { ...DEFAULT_UPGRADES },
    rally: { ...DEFAULT_UPGRADES },
    armored: { ...DEFAULT_UPGRADES },
  },
  unlockedArenas: saved?.unlockedArenas ?? ['arena_1'],
  completedArenas: saved?.completedArenas ?? [],
  currentArena: saved?.currentArena ?? 'arena_1',
  bestScores: saved?.bestScores ?? {},
  bestSurvivalTimes: saved?.bestSurvivalTimes ?? {},
  selectedDifficulty: saved?.selectedDifficulty ?? 'MEDIUM',
  soundMuted: saved?.soundMuted ?? false,

  roomState: null,
  availableLobbies: [],
  multiplayerResults: null,

  selectVehicle: (id: VehicleId) => {
    set((s) => {
      const next = { ...s, selectedVehicle: id };
      saveState(next);
      return { selectedVehicle: id };
    });
  },

  unlockVehicle: (id: VehicleId) => {
    const { coins, unlockedVehicles } = get();
    const vehicle = VEHICLES[id];
    if (!vehicle || unlockedVehicles.includes(id) || coins < vehicle.price) return false;

    set((s) => {
      const next = {
        ...s,
        coins: s.coins - vehicle.price,
        unlockedVehicles: [...s.unlockedVehicles, id],
        selectedVehicle: id,
      };
      saveState(next);
      return next;
    });
    return true;
  },

  upgradeVehicleStat: (vehicleId: VehicleId, stat: keyof VehicleUpgrades) => {
    const { coins, vehicleUpgrades } = get();
    const currentLvl = vehicleUpgrades[vehicleId]?.[stat] || 0;
    if (currentLvl >= 5) return false;

    const upgradeCost = (currentLvl + 1) * 200; // 200, 400, 600, 800, 1000
    if (coins < upgradeCost) return false;

    set((s) => {
      const curVehUpgrades = s.vehicleUpgrades[vehicleId] || { ...DEFAULT_UPGRADES };
      const updatedUpgrades = {
        ...s.vehicleUpgrades,
        [vehicleId]: {
          ...curVehUpgrades,
          [stat]: currentLvl + 1,
        },
      };
      const next = {
        ...s,
        coins: s.coins - upgradeCost,
        vehicleUpgrades: updatedUpgrades,
      };
      saveState(next);
      return next;
    });
    return true;
  },

  selectDifficulty: (diff: AIDifficulty) => {
    set((s) => {
      const next = { ...s, selectedDifficulty: diff };
      saveState(next);
      return { selectedDifficulty: diff };
    });
  },

  selectArena: (arenaId: ArenaId) => {
    set((s) => {
      const next = { ...s, currentArena: arenaId };
      saveState(next);
      return { currentArena: arenaId };
    });
  },

  recordMatchResult: (arenaId, score, survivalTime, eliminations, isWin) => {
    const coinsEarned = (isWin ? 500 : 150) + eliminations * 75 + Math.round(score * 0.1);
    const xpEarned = (isWin ? 300 : 100) + eliminations * 50 + survivalTime * 2;

    const currentArenaDef = ARENAS[arenaId];
    let newArenaUnlocked: ArenaId | null = null;

    set((s) => {
      const updatedCompleted = s.completedArenas.includes(arenaId)
        ? s.completedArenas
        : [...s.completedArenas, arenaId];

      const nextIndex = currentArenaDef ? currentArenaDef.index + 1 : 1;
      const nextArenaDef = Object.values(ARENAS).find((a) => a.index === nextIndex);

      let updatedUnlocked = [...s.unlockedArenas];
      if (isWin && nextArenaDef && !updatedUnlocked.includes(nextArenaDef.id)) {
        updatedUnlocked.push(nextArenaDef.id);
        newArenaUnlocked = nextArenaDef.id;
      }

      const prevBestScore = s.bestScores[arenaId] || 0;
      const prevBestTime = s.bestSurvivalTimes[arenaId] || 0;

      const next = {
        ...s,
        coins: s.coins + coinsEarned,
        xp: s.xp + xpEarned,
        completedArenas: updatedCompleted,
        unlockedArenas: updatedUnlocked,
        currentArena: newArenaUnlocked || s.currentArena,
        bestScores: { ...s.bestScores, [arenaId]: Math.max(prevBestScore, score) },
        bestSurvivalTimes: { ...s.bestSurvivalTimes, [arenaId]: Math.max(prevBestTime, survivalTime) },
      };
      saveState(next);
      return next;
    });

    return { coinsEarned, xpEarned, newArenaUnlocked };
  },

  toggleSound: () => {
    set((s) => {
      const next = { ...s, soundMuted: !s.soundMuted };
      saveState(next);
      return { soundMuted: !s.soundMuted };
    });
  },

  // Socket Lobby & Multiplayer Handlers
  initLobbySockets: (userId: string) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    const handleLobbyState = (state: DerbyRoomState) => {
      if (state && (state.gameType === 'DEMOLITION_DERBY' || !state.gameType)) {
        set({ roomState: state });
      }
    };

    const handleLobbiesList = (lobbies: any[]) => {
      const derbyLobbies = (lobbies || []).filter((l) => l.gameType === 'DEMOLITION_DERBY');
      set({ availableLobbies: derbyLobbies });
    };

    const handleGameOver = (data: { results: any[] }) => {
      set({ multiplayerResults: data.results });
    };

    socket.on('lobby_state', handleLobbyState);
    socket.on('lobbies_list_response', handleLobbiesList);
    socket.on('lobbies_updated', handleLobbiesList);
    socket.on('game_over', handleGameOver);

    socket.emit('lobbies_list');

    return () => {
      socket.off('lobby_state', handleLobbyState);
      socket.off('lobbies_list_response', handleLobbiesList);
      socket.off('lobbies_updated', handleLobbiesList);
      socket.off('game_over', handleGameOver);
    };
  },

  createLobby: (userId: string, nickname: string, arenaId: ArenaId = 'arena_1') => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_create', { gameType: 'DEMOLITION_DERBY', userId, nickname });
      const arenaDef = ARENAS[arenaId];
      if (arenaDef) {
        socket.emit('lobby_settings_update', {
          gameId: get().roomState?.id,
          hostId: userId,
          settings: { arenaId, arenaIndex: arenaDef.index, normalizedStats: true },
        });
      }
    }
  },

  joinLobby: (gameId: string, userId: string, nickname: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_join', { gameId, userId, nickname });
    }
  },

  toggleReady: (gameId: string, userId: string, isReady: boolean) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_ready', { gameId, userId, isReady });
    }
  },

  startMatch: (gameId: string, hostId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('game_start', { gameId, hostId });
    }
  },

  leaveLobby: (userId: string) => {
    const { roomState } = get();
    const socket = socketService.getSocket();
    if (socket && roomState) {
      socket.emit('lobby_leave', { gameId: roomState.id, userId });
      set({ roomState: null, multiplayerResults: null });
    }
  },

  sendTransformUpdate: (gameId: string, userId: string, data: any) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_transform_update', { gameId, userId, ...data });
    }
  },

  sendHitImpact: (gameId: string, userId: string, data: any) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_hit_impact', { gameId, userId, ...data });
    }
  },

  sendReturnToLobby: (gameId: string, userId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_return_to_lobby', { gameId, userId });
    }
  },
}));

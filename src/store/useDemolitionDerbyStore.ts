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
import { derbySoundSystem } from '@/components/games/demolition-derby/DerbySoundSystem';
import { derbyAssetPreloader } from '@/lib/derbyAssetPreloader';

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
  isCreatingLobby: boolean;
  lobbyError: string | null;
  // Authoritative alive count during a match (numerator / denominator)
  matchAliveCount: number;
  matchTotalPlayers: number;

  // Actions
  selectVehicle: (id: VehicleId, userId?: string) => void;
  unlockVehicle: (id: VehicleId, userId?: string) => boolean;
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
  fetchLobbies: () => void;
  clearLobbyError: () => void;
  createLobby: (userId: string, nickname: string, arenaId?: ArenaId) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  reportAssetsReady: (gameId: string, userId: string, selectedCarId?: VehicleId) => void;
  startMatch: (gameId: string, hostId: string) => void;
  leaveLobby: (userId: string) => void;
  sendSelectCar: (gameId: string, userId: string, carId: VehicleId) => void;
  sendSelectArena: (gameId: string, hostId: string, arenaId: ArenaId) => void;
  sendTransformUpdate: (gameId: string, userId: string, data: any) => void;
  sendHitImpact: (gameId: string, userId: string, data: any) => void;
  sendEnvImpact: (gameId: string, userId: string, data: any) => void;
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
  coins: saved?.coins ?? 1200,
  xp: saved?.xp ?? 0,
  unlockedVehicles: saved?.unlockedVehicles ?? ['road_crusher', 'starter'],
  selectedVehicle: saved?.selectedVehicle ?? 'road_crusher',
  vehicleUpgrades: saved?.vehicleUpgrades ?? {
    road_crusher: { ...DEFAULT_UPGRADES },
    iron_tanker: { ...DEFAULT_UPGRADES },
    apex_phantom: { ...DEFAULT_UPGRADES },
    armored_juggernaut: { ...DEFAULT_UPGRADES },
    starter: { ...DEFAULT_UPGRADES },
    muscle: { ...DEFAULT_UPGRADES },
    heavy: { ...DEFAULT_UPGRADES },
    rally: { ...DEFAULT_UPGRADES },
    armored: { ...DEFAULT_UPGRADES },
  },
  // All 7 arenas unlocked for all players
  unlockedArenas: ['arena_1', 'arena_2', 'arena_3', 'arena_4', 'arena_5', 'arena_6', 'arena_7'],
  completedArenas: saved?.completedArenas ?? [],
  currentArena: saved?.currentArena ?? 'arena_1',
  bestScores: saved?.bestScores ?? {},
  bestSurvivalTimes: saved?.bestSurvivalTimes ?? {},
  selectedDifficulty: saved?.selectedDifficulty ?? 'MEDIUM',
  soundMuted: saved?.soundMuted ?? true,

  roomState: null,
  availableLobbies: [],
  multiplayerResults: null,
  isCreatingLobby: false,
  lobbyError: null,
  matchAliveCount: 0,
  matchTotalPlayers: 0,

  selectVehicle: (id: VehicleId, userId?: string) => {
    set((s) => {
      const next = { ...s, selectedVehicle: id };
      saveState(next);
      let updatedRoomState = s.roomState;
      if (s.roomState && userId) {
        updatedRoomState = {
          ...s.roomState,
          players: s.roomState.players.map((p) =>
            p.userId === userId ? { ...p, selectedCarId: id, assetReady: true } : p
          ),
        };
      }
      return { selectedVehicle: id, roomState: updatedRoomState };
    });

    const { roomState } = get();
    if (roomState) {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('derby_select_car', {
          gameId: roomState.id,
          userId: userId || '',
          carId: id,
        });
        socket.emit('derby_assets_ready', {
          gameId: roomState.id,
          userId: userId || '',
          selectedCarId: id,
        });
      }
    }
  },

  unlockVehicle: (id: VehicleId, userId?: string) => {
    const { coins, unlockedVehicles, roomState } = get();
    const vehicle = VEHICLES[id];
    if (!vehicle || unlockedVehicles.includes(id) || coins < vehicle.price) return false;

    const newUnlocked = [...unlockedVehicles, id];
    // Add compatibility aliases
    if (id === 'road_crusher' && !newUnlocked.includes('muscle')) newUnlocked.push('muscle');
    if (id === 'iron_tanker' && !newUnlocked.includes('heavy')) newUnlocked.push('heavy');
    if (id === 'apex_phantom' && !newUnlocked.includes('rally')) newUnlocked.push('rally');
    if (id === 'armored_juggernaut' && !newUnlocked.includes('armored')) newUnlocked.push('armored');

    set((s) => {
      let updatedRoomState = s.roomState;
      if (s.roomState && userId) {
        updatedRoomState = {
          ...s.roomState,
          players: s.roomState.players.map((p) =>
            p.userId === userId ? { ...p, selectedCarId: id } : p
          ),
        };
      }
      const next = {
        ...s,
        coins: s.coins - vehicle.price,
        unlockedVehicles: newUnlocked,
        selectedVehicle: id,
        roomState: updatedRoomState,
      };
      saveState(next);
      return next;
    });

    if (roomState) {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('derby_select_car', {
          gameId: roomState.id,
          userId: userId || '',
          carId: id,
        });
      }
    }
    return true;
  },

  upgradeVehicleStat: (vehicleId: VehicleId, stat: keyof VehicleUpgrades) => {
    const { coins, vehicleUpgrades } = get();
    const currentLvl = vehicleUpgrades[vehicleId]?.[stat] || 0;
    if (currentLvl >= 5) return false;

    const baseCost = 250;
    const upgradeCost = (currentLvl + 1) * baseCost;
    if (coins < upgradeCost) return false;

    set((s) => {
      const updatedUpgrades = {
        ...s.vehicleUpgrades,
        [vehicleId]: {
          ...s.vehicleUpgrades[vehicleId],
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
      const nextMuted = !s.soundMuted;
      const next = { ...s, soundMuted: nextMuted };
      saveState(next);
      derbySoundSystem.setMuted(nextMuted);
      return { soundMuted: nextMuted };
    });
  },

  // Socket Lobby & Multiplayer Handlers
  initLobbySockets: (userId: string) => {
    const socket = socketService.getSocket();
    if (!socket) return () => {};

    const handleLobbyState = (state: DerbyRoomState) => {
      if (state && (state.gameType === 'DEMOLITION_DERBY' || !state.gameType)) {
        const isLobby = state.status === 'LOBBY' || (state.status as string) === 'WAITING';
        set((s) => ({
          roomState: state,
          isCreatingLobby: false,
          lobbyError: null,
          ...(isLobby ? { multiplayerResults: null } : {}),
        }));
      }
    };

    const handleLobbiesList = (lobbies: any[]) => {
      const derbyLobbies = (lobbies || []).filter((l) => l.gameType === 'DEMOLITION_DERBY');
      set({ availableLobbies: derbyLobbies });
    };

    const handleGameOver = (data: { results: any[] }) => {
      set((s) => ({
        multiplayerResults: data.results,
        roomState: s.roomState ? { ...s.roomState, status: 'FINISHED' } : null,
      }));
    };

    const handleGameCountdown = (data: { countdownValue: number; seed: number; matchId?: string; arenaId?: ArenaId; spawnData?: any[]; totalPlayers?: number }) => {
      set((s) => {
        if (!s.roomState) return s;
        if (s.roomState.status === 'PLAYING') return s;
        let updatedPlayers = s.roomState.players;
        if (data.spawnData && Array.isArray(data.spawnData)) {
          updatedPlayers = s.roomState.players.map((p) => {
            const sp = data.spawnData?.find((sd: any) => sd.userId === p.userId);
            return {
              ...p,
              selectedCarId: sp?.vehicleId || sp?.selectedCarId || p.selectedCarId || 'road_crusher',
            };
          });
        }
        return {
          roomState: {
            ...s.roomState,
            status: 'COUNTDOWN',
            countdownValue: data.countdownValue,
            seed: data.seed ?? s.roomState.seed,
            settings: {
              ...s.roomState.settings,
              ...(data.arenaId ? { arenaId: data.arenaId } : {}),
            },
            players: updatedPlayers,
          },
          matchTotalPlayers: data.totalPlayers || s.roomState.players.length,
          matchAliveCount: data.totalPlayers || s.roomState.players.length,
        };
      });
    };

    const handleGameStarted = (data: any) => {
      set((s) => {
        if (!s.roomState) return s;
        let updatedPlayers = s.roomState.players;
        if (data.playerStates && Array.isArray(data.playerStates)) {
          updatedPlayers = s.roomState.players.map((p) => {
            const serverP = data.playerStates.find((sp: any) => sp.userId === p.userId);
            return {
              ...p,
              selectedCarId: serverP?.vehicleId || p.selectedCarId || 'road_crusher',
            };
          });
        }
        return {
          roomState: {
            ...s.roomState,
            status: 'PLAYING',
            seed: data.seed ?? s.roomState.seed,
            startTime: data.startTime,
            settings: { ...s.roomState.settings, ...(data.settings || {}) },
            players: updatedPlayers,
          },
          // Lock in the total player count at match start for alive denominator
          matchTotalPlayers: data.totalPlayers || updatedPlayers.length,
          matchAliveCount: data.totalPlayers || updatedPlayers.length,
        };
      });
    };

    // Player eliminated (destroyed in combat)
    const handleVehicleEliminated = (data: any) => {
      set((s) => ({
        matchAliveCount: typeof data.remainingPlayers === 'number' ? data.remainingPlayers : s.matchAliveCount,
        matchTotalPlayers: typeof data.totalPlayers === 'number' ? data.totalPlayers : s.matchTotalPlayers,
      }));
    };

    // Player disconnected during match — remove from room player list immediately
    const handlePlayerDisconnected = (data: any) => {
      set((s) => {
        const updatedAlive = typeof data.remainingPlayers === 'number' ? data.remainingPlayers : s.matchAliveCount;
        const updatedTotal = typeof data.totalPlayers === 'number' ? data.totalPlayers : s.matchTotalPlayers;
        // Remove disconnected player from roomState players list if present
        if (!s.roomState) return { matchAliveCount: updatedAlive, matchTotalPlayers: updatedTotal };
        const filteredPlayers = s.roomState.players.filter((p: any) => p.userId !== data.userId);
        return {
          matchAliveCount: updatedAlive,
          matchTotalPlayers: updatedTotal,
          roomState: { ...s.roomState, players: filteredPlayers },
        };
      });
    };

    // Canonical Game State Update from Server
    const handleGameStateUpdate = (data: any) => {
      set((s) => {
        const updatedAlive = typeof data.aliveCount === 'number' ? data.aliveCount : s.matchAliveCount;
        const updatedTotal = typeof data.totalPlayers === 'number' ? data.totalPlayers : s.matchTotalPlayers;
        if (!s.roomState || !Array.isArray(data.players)) {
          return { matchAliveCount: updatedAlive, matchTotalPlayers: updatedTotal };
        }

        const updatedPlayers = s.roomState.players.map((p) => {
          const sPlayer = data.players.find((sp: any) => sp.userId === p.userId || sp.playerId === p.userId);
          if (sPlayer) {
            return {
              ...p,
              selectedCarId: sPlayer.vehicleId || p.selectedCarId || 'road_crusher',
              hp: sPlayer.hp,
              maxHp: sPlayer.maxHp,
              alive: sPlayer.alive,
              connected: sPlayer.connected,
              score: sPlayer.score,
              eliminations: sPlayer.eliminations,
              damageDealt: sPlayer.damageDealt,
            };
          }
          return p;
        });

        return {
          matchAliveCount: updatedAlive,
          matchTotalPlayers: updatedTotal,
          roomState: { ...s.roomState, players: updatedPlayers },
        };
      });
    };

    const handleGameError = (err: { message?: string }) => {
      set({ lobbyError: err?.message || 'Multiplayer action failed.', isCreatingLobby: false });
    };

    const handleConnect = () => {
      set({ lobbyError: null });
      socket.emit('lobbies_list');
    };

    const handleConnectError = (err: any) => {
      set({
        isCreatingLobby: false,
        lobbyError: 'Multiplayer server connection error. Please ensure backend server (npm run server) is running on port 3001.',
      });
    };

    socket.on('lobby_state', handleLobbyState);
    socket.on('lobbies_list_response', handleLobbiesList);
    socket.on('lobbies_updated', handleLobbiesList);
    socket.on('game_countdown', handleGameCountdown);
    socket.on('game_started', handleGameStarted);
    socket.on('game_over', handleGameOver);
    socket.on('game_error', handleGameError);
    socket.on('connect', handleConnect);
    socket.on('connect_error', handleConnectError);
    socket.on('derby_vehicle_eliminated', handleVehicleEliminated);
    socket.on('derby_player_disconnected', handlePlayerDisconnected);
    socket.on('derby_game_state_update', handleGameStateUpdate);

    if (socket.connected) {
      socket.emit('lobbies_list');
    }

    return () => {
      socket.off('lobby_state', handleLobbyState);
      socket.off('lobbies_list_response', handleLobbiesList);
      socket.off('lobbies_updated', handleLobbiesList);
      socket.off('game_countdown', handleGameCountdown);
      socket.off('game_started', handleGameStarted);
      socket.off('game_over', handleGameOver);
      socket.off('game_error', handleGameError);
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('derby_vehicle_eliminated', handleVehicleEliminated);
      socket.off('derby_player_disconnected', handlePlayerDisconnected);
      socket.off('derby_game_state_update', handleGameStateUpdate);
    };
  },

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    if (socket && socket.connected) {
      socket.emit('lobbies_list');
    } else if (socket) {
      socket.connect();
    }
  },

  clearLobbyError: () => {
    set({ lobbyError: null });
  },

  createLobby: (userId: string, nickname: string, arenaId: ArenaId = 'arena_1') => {
    const socket = socketService.getSocket();
    if (!socket) {
      set({
        isCreatingLobby: false,
        lobbyError: 'Multiplayer server is unavailable. Please verify backend server on port 3001.',
      });
      return;
    }

    const emitCreate = () => {
      const arenaDef = ARENAS[arenaId] || ARENAS.arena_1;
      const { selectedVehicle } = get();
      const isAssetReady = derbyAssetPreloader.getState().isReady;
      socket.emit('lobby_create', {
        gameType: 'DEMOLITION_DERBY',
        userId,
        nickname,
        selectedCarId: selectedVehicle || 'road_crusher',
        assetReady: isAssetReady,
        arenaId,
        settings: {
          arenaId,
          arenaIndex: arenaDef.index,
          normalizedStats: true,
          maxPlayers: 8,
          selectedCarId: selectedVehicle || 'road_crusher',
        },
      });
    };

    set({ isCreatingLobby: true, lobbyError: null });

    if (socket.connected) {
      emitCreate();
    } else {
      // Connect first and emit once connection is established
      socket.connect();
      const onConnectOnce = () => {
        emitCreate();
      };
      socket.once('connect', onConnectOnce);

      setTimeout(() => {
        socket.off('connect', onConnectOnce);
        if (!socket.connected) {
          set({
            isCreatingLobby: false,
            lobbyError: 'Connection to multiplayer server timed out. Please ensure backend server (npm run server) is running.',
          });
        }
      }, 5000);
    }

    // Safety timeout so UI never remains stuck in "CREATING ROOM..."
    setTimeout(() => {
      if (get().isCreatingLobby && !get().roomState) {
        set({
          isCreatingLobby: false,
          lobbyError: 'Room creation timed out. Please retry or check server logs.',
        });
      }
    }, 8000);
  },

  joinLobby: (gameId: string, userId: string, nickname: string) => {
    const socket = socketService.getSocket();
    if (!socket) {
      set({ lobbyError: 'Multiplayer server is unavailable.' });
      return;
    }
    set({ lobbyError: null });
    const { selectedVehicle } = get();
    const carToSend = selectedVehicle || 'road_crusher';
    const isAssetReady = derbyAssetPreloader.getState().isReady;
    if (!socket.connected) {
      socket.connect();
      socket.once('connect', () => {
        socket.emit('lobby_join', { gameId, userId, nickname, selectedCarId: carToSend, assetReady: isAssetReady });
      });
    } else {
      socket.emit('lobby_join', { gameId, userId, nickname, selectedCarId: carToSend, assetReady: isAssetReady });
    }
  },

  toggleReady: (gameId: string, userId: string, isReady: boolean) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_ready', { gameId, userId, isReady });
    }
  },

  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_kick', { gameId, hostId, targetUserId });
    }
  },

  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('lobby_invite', {
        gameId,
        senderId,
        senderName,
        targetUserId,
        gameType: 'DEMOLITION_DERBY',
      });
    }
  },

  reportAssetsReady: (gameId: string, userId: string, selectedCarId?: VehicleId) => {
    const socket = socketService.getSocket();
    const carId = selectedCarId || get().selectedVehicle || 'road_crusher';
    if (socket) {
      socket.emit('derby_assets_ready', { gameId, userId, selectedCarId: carId });
    }
  },

  startMatch: (gameId: string, hostId?: string) => {
    const socket = socketService.getSocket();
    const actualHostId = hostId || get().roomState?.hostId;
    if (socket) {
      set({ lobbyError: null });
      socket.emit('game_start', { gameId, hostId: actualHostId });
    }
  },

  leaveLobby: (userId: string) => {
    const { roomState } = get();
    const socket = socketService.getSocket();
    if (socket && roomState) {
      socket.emit('lobby_leave', { gameId: roomState.id, userId });
      set({ roomState: null, multiplayerResults: null, isCreatingLobby: false });
    }
  },

  sendSelectCar: (gameId: string, userId: string, carId: VehicleId) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_select_car', { gameId, userId, carId });
    }
  },

  sendSelectArena: (gameId: string, hostId: string, arenaId: ArenaId) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_select_arena', { gameId, hostId, arenaId });
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

  sendEnvImpact: (gameId: string, userId: string, data: any) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_env_impact', { gameId, playerId: userId, ...data });
    }
  },

  sendReturnToLobby: (gameId: string, userId: string) => {
    const socket = socketService.getSocket();
    if (socket) {
      socket.emit('derby_return_to_lobby', { gameId, userId });
    }
  },
}));

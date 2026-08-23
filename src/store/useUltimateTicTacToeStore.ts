import { create } from 'zustand';
import { socketService } from '@/lib/socket';
import { useUserStore } from './useUserStore';

export interface LobbyPlayer {
  userId: string;
  nickname: string;
  isReady: boolean;
  role: 'HOST' | 'PLAYER';
  symbol?: 'X' | 'O';
}

export interface LobbySettings {
  maxPlayers: number;
  turnTimer: number; // seconds
  difficulty?: 'EASY' | 'MEDIUM' | 'HARD';
}

export interface LobbyState {
  id: string;
  hostId: string;
  gameType: string;
  players: LobbyPlayer[];
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  settings?: LobbySettings;
}

export interface Ut3PlayerState {
  userId: string;
  nickname: string;
  role: 'HOST' | 'PLAYER';
  isReady: boolean;
  isOnline: boolean;
  symbol: 'X' | 'O';
}

export interface MoveLog {
  moveNumber: number;
  playerId: string;
  symbol: string;
  boardIndex: number;
  cellIndex: number;
  timestamp: number;
  isTimeoutMove?: boolean;
  miniBoardWon?: boolean;
  miniBoardDraw?: boolean;
  mainBoardWon?: boolean;
  text?: string;
}

export interface UltimateTicTacToeGameState {
  gameId: string;
  gameType: 'ULTIMATE_TIC_TAC_TOE';
  status: 'WAITING' | 'PLAYING' | 'FINISHED';
  currentPlayer: 'X' | 'O';
  currentTurnPlayerId: string | null;
  players: Ut3PlayerState[];

  miniBoards: (string | null)[][]; // 9 boards x 9 cells
  wonBoards: (string | null)[];   // 9 boards (null, 'X', 'O', 'DRAW')
  miniBoardWinningLines: (number[] | null)[]; // 9 boards -> winning triad [0,1,2] or null
  mainBoardWinningLine: number[] | null;       // winning triad [0,4,8] or null

  activeBoard: number | null; // 0..8 or null
  isFreeMove: boolean;

  turnStartedAt: number | null;
  turnExpiresAt: number | null;
  turnTimeLimit: number;
  turnTimeLeft: number;

  winnerId: string | null;
  isDraw: boolean;
  historyLogs: MoveLog[];
  stateVersion: number;
}

export interface PublicLobby {
  id: string;
  hostId: string;
  hostName: string;
  gameType: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  settings?: LobbySettings;
}

interface UltimateTicTacToeStore {
  lobby: LobbyState | null;
  gameState: UltimateTicTacToeGameState | null;
  error: string | null;
  availableLobbies: PublicLobby[];

  // Actions
  createLobby: (userId: string, nickname: string) => void;
  joinLobby: (gameId: string, userId: string, nickname: string) => void;
  toggleReady: (gameId: string, userId: string, isReady: boolean) => void;
  kickPlayer: (gameId: string, hostId: string, targetUserId: string) => void;
  leaveLobby: (gameId: string, userId: string) => void;
  invitePlayer: (gameId: string, senderId: string, senderName: string, targetUserId: string) => void;
  updateSettings: (gameId: string, hostId: string, settings: Partial<LobbySettings>) => void;
  startGame: (gameId: string, hostId: string) => void;
  makeMove: (gameId: string, userId: string, boardIndex: number, cellIndex: number) => void;
  clearState: () => void;
  setError: (msg: string | null) => void;
  fetchLobbies: () => void;

  // Socket Setup
  setupListeners: (gameId: string, targetUserId: string) => () => void;
}

export const useUltimateTicTacToeStore = create<UltimateTicTacToeStore>((set, get) => ({
  lobby: null,
  gameState: null,
  error: null,
  availableLobbies: [],

  createLobby: (userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_create', { gameType: 'ULTIMATE_TIC_TAC_TOE', userId, nickname });
  },

  joinLobby: (gameId, userId, nickname) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_join', { gameId, userId, nickname });
  },

  toggleReady: (gameId, userId, isReady) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_ready', { gameId, userId, isReady });
  },

  kickPlayer: (gameId, hostId, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_kick', { gameId, hostId, targetUserId });
  },

  leaveLobby: (gameId, userId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_leave', { gameId, userId });
    set({ lobby: null, gameState: null, error: null });
  },

  invitePlayer: (gameId, senderId, senderName, targetUserId) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_invite', {
      gameId,
      senderId,
      senderName,
      targetUserId,
      gameType: 'ULTIMATE_TIC_TAC_TOE'
    });
  },

  updateSettings: (gameId, hostId, settings) => {
    const socket = socketService.getSocket();
    socket.emit('lobby_settings_update', { gameId, hostId, settings });
  },

  startGame: (gameId, hostId) => {
    const socket = socketService.getSocket();
    socket.emit('game_start', { gameId, hostId });
  },

  makeMove: (gameId, userId, boardIndex, cellIndex) => {
    const socket = socketService.getSocket();
    socket.emit('game_action', {
      gameId,
      userId,
      action: 'make_move',
      data: { boardIndex, cellIndex }
    });
  },

  clearState: () => set({ lobby: null, gameState: null, error: null }),
  setError: (msg) => set({ error: msg }),

  fetchLobbies: () => {
    const socket = socketService.getSocket();
    socket.emit('lobbies_list');
  },

  setupListeners: (gameId, targetUserId) => {
    const socket = socketService.getSocket();

    const onLobbyState = (state: LobbyState) => {
      if (state.gameType && state.gameType !== 'ULTIMATE_TIC_TAC_TOE') return;
      set({ lobby: state, gameState: null });
    };

    const onGameState = (incomingState: UltimateTicTacToeGameState) => {
      if (incomingState.gameType && incomingState.gameType !== 'ULTIMATE_TIC_TAC_TOE') return;
      const currentState = get().gameState;
      // Prevent overwriting with stale state version
      if (currentState && incomingState.stateVersion !== undefined && incomingState.stateVersion < currentState.stateVersion) {
        return;
      }
      set({ gameState: incomingState, lobby: null });
    };

    const onGameError = (err: { message: string }) => {
      set({ error: err.message });
      setTimeout(() => set({ error: null }), 3000);
    };

    const onKicked = () => {
      set({ lobby: null, gameState: null, error: 'You were kicked by the host.' });
    };

    const onLobbiesList = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
    };

    const onLobbiesUpdated = (lobbies: PublicLobby[]) => {
      set({ availableLobbies: lobbies });
    };

    const handleConnect = () => {
      const currentLobby = get().lobby;
      const currentGameState = get().gameState;
      if (currentLobby) {
        socket.emit('lobby_join', {
          gameId: currentLobby.id,
          userId: targetUserId,
          nickname: useUserStore.getState().nickname || 'Player'
        });
      } else if (currentGameState) {
        socket.emit('game_reconnect', {
          gameId: currentGameState.gameId,
          userId: targetUserId
        });
      }
    };

    socket.on('connect', handleConnect);
    socket.on('lobby_state', onLobbyState);
    socket.on('game_state', onGameState);
    socket.on('game_error', onGameError);
    socket.on(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
    socket.on('lobbies_list_response', onLobbiesList);
    socket.on('lobbies_updated', onLobbiesUpdated);

    return () => {
      socket.off('connect', handleConnect);
      socket.off('lobby_state', onLobbyState);
      socket.off('game_state', onGameState);
      socket.off('game_error', onGameError);
      socket.off(`lobby_kicked_${gameId}_${targetUserId}`, onKicked);
      socket.off('lobbies_list_response', onLobbiesList);
      socket.off('lobbies_updated', onLobbiesUpdated);
    };
  }
}));

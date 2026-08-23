"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  Globe, Bot, Sparkles, BookOpen, Shield, Crown, User, Settings, ArrowLeft, RefreshCw, Zap,
  Copy, MessageSquare
} from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useRoomConnectionStore } from '@/store/useRoomConnectionStore';
import { useUltimateTicTacToeStore } from '@/store/useUltimateTicTacToeStore';
import { GlassCard } from '@/components/layout/GlassCard';
import { ChatArea } from '@/components/room/ChatArea';
import { MessageInput } from '@/components/room/MessageInput';
import { socketService } from '@/lib/socket';
import { sounds } from '@/lib/sounds';
import { useInviteCooldown } from '@/hooks/useInviteCooldown';
import { useExitWarning } from '@/hooks/useExitWarning';

import { SinglePlayerUt3Game, AiDifficulty } from './UltimateTicTacToeEngine';
import { getValidMoves } from './UltimateTicTacToeRules';
import { UltimateTicTacToeBoard } from './UltimateTicTacToeBoard';
import { GameHeader } from './GameHeader';
import { PlayerStatus } from './PlayerStatus';
import { FreeMoveIndicator } from './FreeMoveIndicator';
import { GameResultModal } from './GameResultModal';
import { RulesModal } from './RulesModal';

export const UltimateTicTacToeGameHub: React.FC = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams?.get('gameId');

  const { id: userId, nickname } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();

  const {
    lobby,
    gameState,
    error,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    updateSettings,
    startGame,
    playAgain,
    makeMove,
    clearState,
    setupListeners,
    fetchLobbies
  } = useUltimateTicTacToeStore();

  // Mode Selection: 'MODE_SELECT' | 'SOLO' | 'MULTIPLAYER'
  const [activeMode, setActiveMode] = useState<'MODE_SELECT' | 'SOLO' | 'MULTIPLAYER'>('MODE_SELECT');
  const [selectedDifficulty, setSelectedDifficulty] = useState<AiDifficulty>('MEDIUM');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [pendingInviteUserId, setPendingInviteUserId] = useState<string | null>(null);

  // Singleplayer Game Instance
  const soloGame = useMemo(() => new SinglePlayerUt3Game(selectedDifficulty), []);
  const [localState, setLocalState] = useState(soloGame.state);

  // Invite lists
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  const { triggerInvite, getInviteStatus } = useInviteCooldown(lobby?.id);
  const { bypassWarning } = useExitWarning(activeMode === 'SOLO' || !!lobby || !!gameState);

  // Setup socket listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || '', userId);

    if (gameIdParam && !lobby && !gameState) {
      setActiveMode('MULTIPLAYER');
      const socket = socketService.getSocket();
      const doJoin = () => {
        joinLobby(gameIdParam, userId, nickname || 'Player');
      };
      if (socket?.connected) {
        doJoin();
      } else if (socket) {
        socket.once('connect', doJoin);
        const timer = setTimeout(doJoin, 500);
        return () => {
          socket.off('connect', doJoin);
          clearTimeout(timer);
          cleanup();
        };
      }
    }

    return () => { cleanup(); };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam, joinLobby, nickname, setupListeners]);

  // Leave lobby on unmount
  useEffect(() => {
    return () => {
      const state = useUltimateTicTacToeStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  // Fetch online users & friends
  const fetchOnlineUsers = useCallback(() => {
    if (!userId) return;
    const getApiUrl = () => {
      if (process.env.NEXT_PUBLIC_SOCKET_URL) return process.env.NEXT_PUBLIC_SOCKET_URL;
      if (typeof window !== 'undefined') return `http://${window.location.hostname}:3001`;
      return 'http://localhost:3001';
    };
    const API_URL = getApiUrl();

    fetch(`${API_URL}/api/users/online`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setOnlineUsers(data.filter(u => u.id !== userId)); })
      .catch(console.error);

    fetch(`${API_URL}/api/notifications/friendships/${userId}`)
      .then(res => res.json())
      .then(data => { if (Array.isArray(data)) setFriendsList(data); })
      .catch(console.error);

    if (currentRoomId) {
      fetch(`${API_URL}/api/rooms/${currentRoomId}/users`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId)); })
        .catch(console.error);
    }
  }, [userId, currentRoomId]);

  useEffect(() => {
    fetchOnlineUsers();
    const socket = socketService.getSocket();
    if (socket) {
      socket.on('user_online', fetchOnlineUsers);
      socket.on('user_offline', fetchOnlineUsers);
      return () => {
        socket.off('user_online', fetchOnlineUsers);
        socket.off('user_offline', fetchOnlineUsers);
      };
    }
  }, [fetchOnlineUsers]);

  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => { socket.off('connect', doFetch); };
  }, [userId, fetchLobbies]);

  // Handle pending invite after creating lobby
  useEffect(() => {
    if (pendingInviteUserId && lobby && userId && nickname) {
      invitePlayer(lobby.id, userId, nickname, pendingInviteUserId);
      triggerInvite(pendingInviteUserId);
      setPendingInviteUserId(null);
    }
  }, [pendingInviteUserId, lobby, userId, nickname, invitePlayer, triggerInvite]);

  // Copy Lobby Link Handler
  const handleCopyLink = useCallback(() => {
    if (!lobby) return;
    const url = `${window.location.origin}/dashboard/games/ultimate-tic-tac-toe?gameId=${lobby.id}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    });
  }, [lobby]);

  // Send Direct Invite Handler
  const handleSendInvite = useCallback((targetUserId: string) => {
    if (!userId || !nickname) return;
    if (!lobby) {
      setPendingInviteUserId(targetUserId);
      createLobby(userId, nickname);
    } else {
      invitePlayer(lobby.id, userId, nickname, targetUserId);
      triggerInvite(targetUserId);
    }
  }, [userId, nickname, lobby, createLobby, invitePlayer, triggerInvite]);

  // Singleplayer Timer Countdown & Timeout Auto-Move Effect
  useEffect(() => {
    if (activeMode !== 'SOLO' || localState.status !== 'PLAYING') return;

    const interval = setInterval(() => {
      setLocalState(prev => {
        if (prev.status !== 'PLAYING') return prev;
        const nextTimer = prev.turnTimeLeft - 1;

        if (nextTimer <= 0) {
          // Timer expired! Execute move automatically
          if (prev.currentPlayer === 'X') {
            const validMoves = getValidMoves(prev.miniBoards, prev.wonBoards, prev.activeBoard, prev.isFreeMove);
            if (validMoves.length > 0) {
              const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
              soloGame.makeMove(randomMove.boardIndex, randomMove.cellIndex);
              // Trigger AI turn after human timeout move
              setTimeout(() => {
                const aiMove = soloGame.computeAiMove();
                if (aiMove) {
                  soloGame.makeMove(aiMove.boardIndex, aiMove.cellIndex);
                  setLocalState({ ...soloGame.state });
                }
              }, 400);
            }
          } else {
            const aiMove = soloGame.computeAiMove();
            if (aiMove) {
              soloGame.makeMove(aiMove.boardIndex, aiMove.cellIndex);
            }
          }
          return { ...soloGame.state, turnTimeLeft: 30 };
        }

        return { ...prev, turnTimeLeft: nextTimer };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [activeMode, localState.status, localState.currentPlayer, soloGame]);

  // Singleplayer Move Handler
  const handleSoloCellClick = (boardIndex: number, cellIndex: number) => {
    if (soloGame.state.currentPlayer !== 'X' || soloGame.state.status !== 'PLAYING') return;

    const success = soloGame.makeMove(boardIndex, cellIndex);
    if (!success) return;

    const newState = { ...soloGame.state };
    setLocalState(newState);

    // AI Turn Trigger
    if (newState.status === 'PLAYING' && newState.currentPlayer === 'O') {
      setTimeout(() => {
        const aiMove = soloGame.computeAiMove();
        if (aiMove) {
          soloGame.makeMove(aiMove.boardIndex, aiMove.cellIndex);
          setLocalState({ ...soloGame.state });
        }
      }, 350);
    }
  };

  const handleStartSoloGame = () => {
    soloGame.resetGame(selectedDifficulty);
    setLocalState({ ...soloGame.state });
    setActiveMode('SOLO');
  };

  const handleResetSolo = () => {
    soloGame.resetGame(selectedDifficulty);
    setLocalState({ ...soloGame.state });
  };

  // Multiplayer Move Handler
  const handleMultiplayerCellClick = (boardIndex: number, cellIndex: number) => {
    const activeGameId = gameState?.gameId;
    if (!activeGameId || !userId) return;
    makeMove(activeGameId, userId, boardIndex, cellIndex);
  };

  const handleLeave = () => {
    bypassWarning();
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    clearState();
    setActiveMode('MODE_SELECT');
    router.push('/dashboard/games');
  };

  const handleBackToMenu = () => {
    bypassWarning();
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    clearState();
    setActiveMode('MODE_SELECT');
  };

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    setActiveMode('MULTIPLAYER');
    createLobby(userId, nickname);
  };

  // Compute boards won counts for X and O
  const counts = useMemo(() => {
    const currentWonBoards = gameState ? gameState.wonBoards : localState.wonBoards;
    let x = 0;
    let o = 0;
    currentWonBoards.forEach(b => {
      if (b === 'X') x++;
      if (b === 'O') o++;
    });
    return { x, o };
  }, [gameState, localState]);

  // ── INVITE FRIENDS MODAL ──
  const renderInviteModal = () => (
    <AnimatePresence>
      {showInviteModal && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-md w-full max-h-[80vh] flex flex-col shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-cyan-400" />
                Invite Friends
              </h3>
              <button
                onClick={() => setShowInviteModal(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px]">
              {onlineUsers.length === 0 ? (
                <div className="text-center py-10 text-gray-500 text-sm space-y-1">
                  <p>No other players online right now.</p>
                  <p className="text-xs text-gray-600">Share your lobby link with friends directly!</p>
                </div>
              ) : (
                onlineUsers.map((u) => {
                  const isFriend = friendsList.some((f) => f.id === u.id);
                  const status = getInviteStatus(u.id);
                  return (
                    <div
                      key={u.id}
                      className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              (u.nickname || '?')[0].toUpperCase()
                            )}
                          </div>
                          <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-neutral-900 bg-emerald-400" />
                        </div>
                        <div>
                          <span className="font-semibold text-sm text-white block leading-tight">{u.nickname}</span>
                          <span className="text-[10px] text-gray-400">
                            {isFriend ? 'Friend · Online' : 'Online'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => handleSendInvite(u.id)}
                        disabled={!status.canInvite}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          !status.canInvite
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 cursor-not-allowed'
                            : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md shadow-cyan-500/20'
                        }`}
                      >
                        {status.canInvite ? 'Invite' : status.label}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <button
              onClick={() => setShowInviteModal(false)}
              className="w-full py-2.5 bg-white/10 hover:bg-white/15 text-gray-300 hover:text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ================================================
  // MODE SELECT VIEW (PAPERFALL NAVBAR + HERO + 2-COLUMN LOBBIES & ONLINE PLAYERS)
  // ================================================
  if (activeMode === 'MODE_SELECT' && !lobby && !gameState) {
    const ut3Lobbies = availableLobbies.filter(l => l.gameType === 'ULTIMATE_TIC_TAC_TOE');

    return (
      <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-x-hidden w-full max-w-full">
        <GameHeader
          onOpenRules={() => setShowRulesModal(true)}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
          <div className="max-w-3xl w-full space-y-6">
            {/* Header Hero Card */}
            <GlassCard className="p-6 sm:p-8 text-center relative overflow-hidden border-white/10 shadow-2xl">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto bg-gradient-to-br from-cyan-500 via-indigo-600 to-purple-800 rounded-3xl flex items-center justify-center text-3xl sm:text-4xl mb-3 shadow-xl shadow-cyan-500/20">
                📐
              </div>
              <h2 className="text-2xl sm:text-3xl font-black tracking-wide mb-1.5 text-white">
                Ultimate Tic-Tac-Toe
              </h2>
              <p className="text-gray-400 text-xs sm:text-sm max-w-md mx-auto mb-6 font-medium leading-relaxed">
                Conquer 3 mini-boards in a row across a 9x9 grid. Every move forces your opponent into a specific sub-board!
              </p>

              {/* Mode Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                {/* Singleplayer Practice Card */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2.5 rounded-xl bg-cyan-500/20 text-cyan-400">
                        <Bot className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        SOLO PRACTICE
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white">Play vs AI</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Select difficulty before starting match:</p>

                    {/* AI Difficulty Selector Buttons */}
                    <div className="grid grid-cols-3 gap-1.5 mt-3">
                      {(
                        [
                          { id: 'EASY', label: 'EASY', desc: 'Casual' },
                          { id: 'MEDIUM', label: 'MEDIUM', desc: 'Balanced' },
                          { id: 'HARD', label: 'HARD', desc: 'Minimax AI' }
                        ] as const
                      ).map(diff => (
                        <button
                          key={diff.id}
                          onClick={() => setSelectedDifficulty(diff.id)}
                          className={`py-2 px-1 rounded-xl text-center transition-all cursor-pointer border ${
                            selectedDifficulty === diff.id
                              ? 'bg-cyan-500 text-black border-cyan-400 font-black shadow-lg shadow-cyan-500/30 scale-[1.03]'
                              : 'bg-white/5 hover:bg-white/10 text-gray-300 border-white/10 font-bold'
                          }`}
                        >
                          <div className="text-xs">{diff.label}</div>
                          <div className={`text-[9px] ${selectedDifficulty === diff.id ? 'text-black/80 font-semibold' : 'text-gray-500'}`}>
                            {diff.desc}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleStartSoloGame}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Play className="w-4 h-4 fill-white" /> Start Practice Match
                  </button>
                </div>

                {/* Multiplayer 1v1 Card */}
                <div className="p-5 rounded-2xl bg-white/5 border border-white/10 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400">
                        <Users className="w-5 h-5" />
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30">
                        ONLINE 1V1
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-white">Multiplayer Arena</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Host a 1v1 game room or invite friends directly to play real-time against other players.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <button
                      onClick={handleCreateLobby}
                      className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <UserPlus className="w-4 h-4" /> Create Game Lobby
                    </button>
                  </div>
                </div>
              </div>
            </GlassCard>

            {/* 2-Column Section: Open Lobbies & Online Players */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left: Open Lobbies */}
              <GlassCard className="p-5 border-white/10 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-white uppercase tracking-wider">
                    <Globe className="w-4 h-4 text-cyan-400" /> Open Lobbies ({ut3Lobbies.length})
                  </h3>
                  <button
                    onClick={() => fetchLobbies()}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Refresh lobbies"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[280px] pr-1">
                  {ut3Lobbies.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-xs italic">
                      No open lobbies right now. Create one to get started!
                    </div>
                  ) : (
                    ut3Lobbies.map(l => (
                      <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                        <div>
                          <div className="font-bold text-sm text-white">{l.hostName}&apos;s Match</div>
                          <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players • 1v1 Room</div>
                        </div>
                        <button
                          onClick={() => {
                            if (!userId) return;
                            setActiveMode('MULTIPLAYER');
                            joinLobby(l.id, userId, nickname || 'Player');
                          }}
                          className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-full text-xs font-bold text-white transition-all hover:scale-105 cursor-pointer"
                        >
                          Join Room
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </GlassCard>

              {/* Right: Online Players for Quick Invites */}
              <GlassCard className="p-5 border-white/10 flex flex-col">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-white uppercase tracking-wider">
                    <UserPlus className="w-4 h-4 text-violet-400" /> Online Players ({onlineUsers.length})
                  </h3>
                  <button
                    onClick={fetchOnlineUsers}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Refresh online users"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[280px] pr-1">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-10 text-gray-500 text-xs italic">
                      No other players online right now. Create a lobby and share your link!
                    </div>
                  ) : (
                    onlineUsers.map(u => {
                      const isFriend = friendsList.some(f => f.id === u.id);
                      const status = getInviteStatus(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (u.nickname || '?')[0].toUpperCase()
                                )}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-neutral-900 bg-emerald-400" />
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-white block leading-tight">{u.nickname}</span>
                              <span className="text-[9px] text-gray-400">{isFriend ? 'Friend · Online' : 'Online'}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendInvite(u.id)}
                            disabled={!status.canInvite}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              !status.canInvite
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white shadow-sm'
                            }`}
                          >
                            {status.canInvite ? 'Invite' : status.label}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
        {renderInviteModal()}
      </div>
    );
  }

  // ================================================
  // SINGLEPLAYER SOLO PRACTICE VIEW
  // ================================================
  if (activeMode === 'SOLO') {
    const isHumanTurn = localState.currentPlayer === 'X';

    return (
      <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-x-hidden w-full max-w-full">
        <GameHeader
          onBack={() => setActiveMode('MODE_SELECT')}
          backTitle="Back to Menu"
          onOpenRules={() => setShowRulesModal(true)}
          turnTimeLeft={localState.turnTimeLeft}
          isMyTurn={isHumanTurn}
          status={localState.status}
          onResetPractice={handleResetSolo}
          isSinglePlayer
        />

        {/* Player Status Cards */}
        <PlayerStatus
          playerX={{ nickname: nickname || 'You' }}
          playerO={{ nickname: `AI (${selectedDifficulty})` }}
          currentTurnSymbol={localState.currentPlayer}
          mySymbol="X"
          boardsWonX={counts.x}
          boardsWonO={counts.o}
        />

        {/* Free Move / Target Board Banner */}
        <FreeMoveIndicator
          isFreeMove={localState.isFreeMove}
          activeBoard={localState.activeBoard}
        />

        {/* Dynamic Responsive Board Container */}
        <div className="flex-1 flex items-center justify-center p-1 sm:p-2 overflow-hidden">
          <UltimateTicTacToeBoard
            miniBoards={localState.miniBoards}
            wonBoards={localState.wonBoards}
            miniBoardWinningLines={localState.miniBoardWinningLines}
            mainBoardWinningLine={localState.mainBoardWinningLine}
            activeBoard={localState.activeBoard}
            isFreeMove={localState.isFreeMove}
            isMyTurn={isHumanTurn}
            mySymbol="X"
            onCellClick={handleSoloCellClick}
          />
        </div>

        {/* Match Result Modal */}
        <GameResultModal
          isOpen={localState.status === 'FINISHED'}
          winnerSymbol={localState.winner}
          winnerNickname={localState.winner === 'X' ? nickname || 'You' : `AI (${selectedDifficulty})`}
          isDraw={localState.isDraw}
          mySymbol="X"
          boardsWonX={counts.x}
          boardsWonO={counts.o}
          moveCount={localState.historyLogs.length}
          onPlayAgain={handleResetSolo}
          onExit={() => setActiveMode('MODE_SELECT')}
        />

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    );
  }

  // ================================================
  // MULTIPLAYER LOBBY VIEW (WITH RICH INVITE OPTIONS & COPY LINK)
  // ================================================
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
    const settings = lobby.settings || { maxPlayers: 2, turnTimer: 30 };
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length === 2 && allReady;

    return (
      <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-x-hidden w-full max-w-full">
        <GameHeader
          onBack={handleBackToMenu}
          backTitle="Back to Menu"
          onOpenRules={() => setShowRulesModal(true)}
        />

        <div className="flex-1 flex flex-col max-w-4xl w-full mx-auto p-4 sm:p-6 space-y-6 my-auto">
          {/* Lobby Code Header Banner with Copy Link and Invite Button */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Lobby Code:</div>
              <code className="text-sm font-mono text-cyan-400 font-bold bg-black/40 px-3 py-1 rounded-lg border border-white/10">
                {lobby.id}
              </code>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <button
                onClick={handleCopyLink}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-gray-300 hover:text-white transition-all flex items-center gap-1.5 cursor-pointer"
              >
                {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
              </button>

              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-xs font-bold text-white transition-all flex items-center gap-1.5 shadow-md shadow-violet-500/20 cursor-pointer"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Friends</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Columns: Match Players & Settings */}
            <div className="lg:col-span-2 space-y-5">
              {/* Players Card */}
              <GlassCard className="p-6 border-white/10">
                <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-white">
                  <Users className="w-5 h-5 text-cyan-400" /> Match Room ({players.length}/2 Players)
                </h2>

                <div className="space-y-3 mb-6">
                  {players.map(p => (
                    <div key={p.userId} className="flex items-center justify-between p-3.5 bg-white/5 rounded-xl border border-white/10">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow">
                          {p.nickname?.[0]?.toUpperCase() || '?'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">{p.nickname}</span>
                            {p.userId === userId && <span className="text-[10px] text-cyan-400 font-semibold">(You)</span>}
                          </div>
                          <span className="text-[10px] text-gray-400">
                            {p.role === 'HOST' ? 'Match Host' : 'Challenger'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {p.role === 'HOST' || p.isReady ? (
                          <span className="text-emerald-400 text-xs font-bold flex items-center gap-1 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                            <Check className="w-3.5 h-3.5" /> Ready
                          </span>
                        ) : (
                          <span className="text-amber-400 text-xs font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                            Waiting...
                          </span>
                        )}
                        {isHost && p.userId !== userId && (
                          <button
                            onClick={() => kickPlayer(lobby.id, userId, p.userId)}
                            className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Kick player"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}

                  {players.length < 2 && (
                    <div className="p-4 rounded-xl border border-dashed border-white/15 text-center text-gray-500 text-xs space-y-1 bg-white/[0.02]">
                      <p>Waiting for opponent to join...</p>
                      <p className="text-[11px] text-gray-600">Share your lobby link or invite an online player from the right!</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  {!isHost && (
                    <button
                      onClick={() => {
                        if (!userId) return;
                        const me = players.find(p => p.userId === userId);
                        if (me) toggleReady(lobby.id, userId, !me.isReady);
                      }}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                        players.find(p => p.userId === userId)?.isReady
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
                          : 'bg-amber-600 hover:bg-amber-500 text-white shadow-lg shadow-amber-600/20'
                      }`}
                    >
                      {players.find(p => p.userId === userId)?.isReady ? '✓ Ready' : 'Ready Up'}
                    </button>
                  )}

                  {isHost && (
                    <button
                      onClick={() => {
                        if (!userId) return;
                        startGame(lobby.id, userId);
                      }}
                      disabled={!canStart}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                        canStart
                          ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-95'
                          : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
                      }`}
                    >
                      <Play className="w-5 h-5 inline mr-2" /> Start Match
                    </button>
                  )}
                </div>
              </GlassCard>

              {/* Lobby Settings Card */}
              <GlassCard className="p-6 border-white/10">
                <h2 className="text-base font-bold mb-4 flex items-center gap-2 text-white">
                  <Settings className="w-5 h-5 text-cyan-400" /> Room Settings
                </h2>
                <div className="text-sm">
                  <div>
                    <label className="text-gray-400 block mb-1.5 text-xs font-semibold">Turn Timeout Limit</label>
                    <select
                      disabled={!isHost}
                      value={settings.turnTimer}
                      onChange={e => {
                        if (!userId) return;
                        updateSettings(lobby.id, userId, { turnTimer: Number(e.target.value) });
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-sans cursor-pointer text-xs"
                    >
                      <option value={15} className="bg-neutral-900">15 seconds</option>
                      <option value={30} className="bg-neutral-900">30 seconds</option>
                      <option value={45} className="bg-neutral-900">45 seconds</option>
                      <option value={60} className="bg-neutral-900">60 seconds</option>
                    </select>
                  </div>
                </div>

                {!isHost && (
                  <span className="text-[11px] text-gray-500 mt-3 block">Only the room host can change settings.</span>
                )}
              </GlassCard>
            </div>

            {/* Right Column: Online Players to Invite */}
            <div className="space-y-4">
              <GlassCard className="p-5 border-white/10 flex flex-col h-full">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold flex items-center gap-2 text-white uppercase tracking-wider">
                    <UserPlus className="w-4 h-4 text-violet-400" /> Online Players ({onlineUsers.length})
                  </h3>
                  <button
                    onClick={fetchOnlineUsers}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Refresh online users"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[380px] pr-1">
                  {onlineUsers.length === 0 ? (
                    <div className="text-center py-12 text-gray-500 text-xs italic space-y-1">
                      <p>No other players online.</p>
                      <p className="text-[10px] text-gray-600">Copy your lobby link above to send to friends!</p>
                    </div>
                  ) : (
                    onlineUsers.map(u => {
                      const isFriend = friendsList.some(f => f.id === u.id);
                      const status = getInviteStatus(u.id);
                      return (
                        <div
                          key={u.id}
                          className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                        >
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (u.nickname || '?')[0].toUpperCase()
                                )}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border-2 border-neutral-900 bg-emerald-400" />
                            </div>
                            <div>
                              <span className="font-semibold text-xs text-white block leading-tight">{u.nickname}</span>
                              <span className="text-[9px] text-gray-400">{isFriend ? 'Friend · Online' : 'Online'}</span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendInvite(u.id)}
                            disabled={!status.canInvite}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                              !status.canInvite
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 text-white shadow-sm'
                            }`}
                          >
                            {status.canInvite ? 'Invite' : status.label}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </GlassCard>
            </div>
          </div>
        </div>

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
        {renderInviteModal()}
      </div>
    );
  }

  // ================================================
  // MULTIPLAYER ACTIVE GAME VIEW
  // ================================================
  if (gameState) {
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    const playerX = gameState.players.find(p => p.symbol === 'X') || { nickname: 'Player X' };
    const playerO = gameState.players.find(p => p.symbol === 'O') || { nickname: 'Player O' };
    const myPlayerState = gameState.players.find(p => p.userId === userId);
    const mySymbol = myPlayerState?.symbol || 'X';

    const winnerPlayer = gameState.players.find(p => p.userId === gameState.winnerId);

    return (
      <div className="flex flex-col min-h-screen bg-black text-white font-sans overflow-x-hidden w-full max-w-full">
        <GameHeader
          onBack={handleBackToMenu}
          backTitle="Back to Menu"
          onOpenRules={() => setShowRulesModal(true)}
          turnExpiresAt={gameState.turnExpiresAt}
          turnTimeLeft={gameState.turnTimeLeft}
          isMyTurn={isMyTurn}
          status={gameState.status}
        />

        {/* Player Status Cards */}
        <PlayerStatus
          playerX={playerX}
          playerO={playerO}
          currentTurnSymbol={gameState.currentPlayer}
          mySymbol={mySymbol}
          boardsWonX={counts.x}
          boardsWonO={counts.o}
        />

        {/* Free Move / Target Board Indicator */}
        <FreeMoveIndicator
          isFreeMove={gameState.isFreeMove}
          activeBoard={gameState.activeBoard}
        />

        {/* Main Game Board */}
        <div className="flex-1 flex overflow-hidden">
          {/* Room Chat Sidebar (Collapsible on wide screens) */}
          {currentRoomId && (
            <div className="hidden lg:flex w-80 border-r border-white/10 bg-neutral-950 flex-col">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold text-white">Room Chat</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatArea roomId={currentRoomId} />
              </div>
              <MessageInput roomId={currentRoomId} />
            </div>
          )}

          <div className="flex-1 flex items-center justify-center p-1 sm:p-2 overflow-hidden bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-gray-900 to-black">
            <UltimateTicTacToeBoard
              miniBoards={gameState.miniBoards}
              wonBoards={gameState.wonBoards}
              miniBoardWinningLines={gameState.miniBoardWinningLines}
              mainBoardWinningLine={gameState.mainBoardWinningLine}
              activeBoard={gameState.activeBoard}
              isFreeMove={gameState.isFreeMove}
              isMyTurn={isMyTurn}
              mySymbol={mySymbol}
              onCellClick={handleMultiplayerCellClick}
            />
          </div>
        </div>

        {/* Match Result Modal */}
        <GameResultModal
          isOpen={gameState.status === 'FINISHED'}
          winnerSymbol={winnerPlayer?.symbol || null}
          winnerNickname={winnerPlayer?.nickname}
          isDraw={gameState.isDraw}
          mySymbol={mySymbol}
          boardsWonX={counts.x}
          boardsWonO={counts.o}
          moveCount={gameState.historyLogs.length}
          onPlayAgain={() => {
            if (userId && gameState.gameId) {
              playAgain(gameState.gameId, userId);
            }
          }}
          onExit={handleBackToMenu}
        />

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black items-center justify-center text-white font-sans">
      <div className="flex flex-col items-center gap-2">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        <span className="text-sm text-gray-400 font-semibold">Loading Ultimate Tic-Tac-Toe Arena...</span>
      </div>
    </div>
  );
};


"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  Globe, Bot, Sparkles, BookOpen, Shield, Crown, User, Settings, ArrowLeft, RefreshCw, Zap
} from 'lucide-react';
import { useUserStore } from '@/store/useUserStore';
import { useRoomConnectionStore } from '@/store/useRoomConnectionStore';
import { useVoiceStore } from '@/store/useVoiceStore';
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
  const { isMuted, toggleMute } = useVoiceStore();

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
    makeMove,
    clearState,
    setupListeners,
    fetchLobbies
  } = useUltimateTicTacToeStore();

  // Mode Selection: 'MODE_SELECT' | 'SOLO' | 'MULTIPLAYER'
  const [activeMode, setActiveMode] = useState<'MODE_SELECT' | 'SOLO' | 'MULTIPLAYER'>('MODE_SELECT');
  const [selectedDifficulty, setSelectedDifficulty] = useState<AiDifficulty>('MEDIUM');
  const [showRulesModal, setShowRulesModal] = useState(false);

  // Singleplayer Game Instance
  const soloGame = useMemo(() => new SinglePlayerUt3Game(selectedDifficulty), []);
  const [localState, setLocalState] = useState(soloGame.state);

  // Invite lists
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);

  const { bypassWarning } = useExitWarning(activeMode === 'SOLO' || !!lobby || !!gameState);

  // Setup socket listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || '', userId);

    if (gameIdParam && !lobby && !gameState) {
      setActiveMode('MULTIPLAYER');
      joinLobby(gameIdParam, userId, nickname || 'Player');
    }

    return () => { cleanup(); };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

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

  // Fetch online users & lobbies
  useEffect(() => {
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

    if (currentRoomId) {
      fetch(`${API_URL}/api/rooms/${currentRoomId}/users`)
        .then(res => res.json())
        .then(data => { if (Array.isArray(data)) setRoomMembers(data.filter(u => u.id !== userId)); })
        .catch(console.error);
    }
  }, [userId, currentRoomId, lobby?.id]);

  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => { socket.off('connect', doFetch); };
  }, [userId]);

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

    setLocalState({ ...soloGame.state });

    // AI Turn Trigger
    if (soloGame.state.status === 'PLAYING' && soloGame.state.currentPlayer === 'O') {
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

  // ================================================
  // MODE SELECT VIEW (WITH DIFFICULTY SELECTION BEFORE GAME STARTS)
  // ================================================
  if (activeMode === 'MODE_SELECT' && !lobby && !gameState) {
    const ut3Lobbies = availableLobbies.filter(l => l.gameType === 'ULTIMATE_TIC_TAC_TOE');

    return (
      <div className="flex flex-col h-screen bg-black text-white select-none font-sans overflow-y-auto">
        <GameHeader
          onBack={() => router.push('/dashboard/games')}
          onOpenRules={() => setShowRulesModal(true)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />

        <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 my-auto">
          <div className="max-w-2xl w-full space-y-6">
            {/* Header Card */}
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
                      Host a 1v1 game room or join open public lobbies to play real-time against other players.
                    </p>
                  </div>

                  <button
                    onClick={handleCreateLobby}
                    className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <UserPlus className="w-4 h-4" /> Create Game Lobby
                  </button>
                </div>
              </div>
            </GlassCard>

            {/* Public Lobbies List */}
            {ut3Lobbies.length > 0 && (
              <GlassCard className="p-5 border-white/10">
                <h3 className="text-base font-bold mb-3 flex items-center gap-2 text-white">
                  <Globe className="w-4 h-4 text-cyan-400" /> Open Lobbies ({ut3Lobbies.length})
                </h3>
                <div className="space-y-2.5">
                  {ut3Lobbies.map(l => (
                    <div key={l.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-colors">
                      <div>
                        <div className="font-bold text-sm text-white">{l.hostName}&apos;s Match</div>
                        <div className="text-xs text-gray-400">{l.playerCount}/{l.maxPlayers} players • 1v1 Room</div>
                      </div>
                      <button
                        onClick={() => {
                          setActiveMode('MULTIPLAYER');
                          joinLobby(l.id, userId, nickname || 'Player');
                        }}
                        className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-full text-xs font-bold text-white transition-all hover:scale-105 cursor-pointer"
                      >
                        Join Room
                      </button>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}
          </div>
        </div>

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
      </div>
    );
  }

  // ================================================
  // SINGLEPLAYER SOLO PRACTICE VIEW (WITHOUT TOP DIFFICULTY BAR IN GAME)
  // ================================================
  if (activeMode === 'SOLO') {
    const isHumanTurn = localState.currentPlayer === 'X';

    return (
      <div className="flex flex-col h-screen max-h-screen bg-black text-white select-none font-sans overflow-hidden">
        <GameHeader
          onBack={() => setActiveMode('MODE_SELECT')}
          onOpenRules={() => setShowRulesModal(true)}
          turnTimeLeft={localState.turnTimeLeft}
          isMyTurn={isHumanTurn}
          status={localState.status}
          isMuted={isMuted}
          onToggleMute={toggleMute}
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
  // MULTIPLAYER LOBBY VIEW
  // ================================================
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
    const settings = lobby.settings || { maxPlayers: 2, turnTimer: 30 };
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length === 2 && allReady;

    return (
      <div className="flex flex-col h-screen bg-black text-white select-none font-sans">
        <GameHeader
          onBack={handleLeave}
          onOpenRules={() => setShowRulesModal(true)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
        />

        <div className="flex-1 flex flex-col md:flex-row items-center justify-center p-6 gap-6 overflow-y-auto">
          {/* Players Card */}
          <GlassCard className="p-6 max-w-md w-full border-white/10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Users className="w-5 h-5 text-cyan-400" /> Match Room ({players.length}/2 Players)
            </h2>

            <div className="space-y-3 mb-6">
              {players.map(p => (
                <div key={p.userId} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center text-xs font-bold text-white shadow">
                      {p.nickname?.[0]?.toUpperCase() || '?'}
                    </div>
                    <span className="font-bold text-sm text-white">{p.nickname}</span>
                    {p.role === 'HOST' && (
                      <span className="text-[10px] bg-cyan-500/30 text-cyan-300 px-2 py-0.5 rounded-full font-bold">
                        HOST
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {p.role === 'HOST' || p.isReady ? (
                      <span className="text-emerald-400 text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> Ready
                      </span>
                    ) : (
                      <span className="text-amber-400 text-xs font-bold">Waiting...</span>
                    )}
                    {isHost && p.userId !== userId && (
                      <button
                        onClick={() => kickPlayer(lobby.id, userId, p.userId)}
                        className="text-rose-400 hover:text-rose-300 text-xs ml-2 cursor-pointer"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              {!isHost && (
                <button
                  onClick={() => {
                    const me = players.find(p => p.userId === userId);
                    if (me) toggleReady(lobby.id, userId, !me.isReady);
                  }}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                    players.find(p => p.userId === userId)?.isReady
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                      : 'bg-amber-600 hover:bg-amber-500 text-white'
                  }`}
                >
                  {players.find(p => p.userId === userId)?.isReady ? '✓ Ready' : 'Ready Up'}
                </button>
              )}

              {isHost && (
                <button
                  onClick={() => startGame(lobby.id, userId)}
                  disabled={!canStart}
                  className={`flex-1 py-3 rounded-xl font-bold transition-all cursor-pointer ${
                    canStart
                      ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white shadow-lg shadow-cyan-500/30 hover:scale-[1.02] active:scale-95'
                      : 'bg-gray-800 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Play className="w-5 h-5 inline mr-2" /> Start Match
                </button>
              )}
            </div>
          </GlassCard>

          {/* Lobby Settings Card */}
          <GlassCard className="p-6 max-w-sm w-full border-white/10">
            <h2 className="text-lg font-bold mb-4 flex items-center gap-2 text-white">
              <Settings className="w-5 h-5 text-cyan-400" /> Room Settings
            </h2>
            <div className="space-y-4 text-sm">
              <div>
                <label className="text-gray-400 block mb-1 text-xs font-semibold">Turn Timeout Limit</label>
                <select
                  disabled={!isHost}
                  value={settings.turnTimer}
                  onChange={e => updateSettings(lobby.id, userId, { turnTimer: Number(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-sans cursor-pointer"
                >
                  <option value={15} className="bg-neutral-900">15 seconds</option>
                  <option value={30} className="bg-neutral-900">30 seconds</option>
                  <option value={45} className="bg-neutral-900">45 seconds</option>
                  <option value={60} className="bg-neutral-900">60 seconds</option>
                </select>
              </div>

              <div>
                <label className="text-gray-400 block mb-1 text-xs font-semibold">Match Difficulty Mode</label>
                <select
                  disabled={!isHost}
                  value={settings.difficulty || 'MEDIUM'}
                  onChange={e => updateSettings(lobby.id, userId, { difficulty: e.target.value as any })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500 disabled:opacity-50 font-sans cursor-pointer"
                >
                  <option value="EASY" className="bg-neutral-900">Easy (Casual)</option>
                  <option value="MEDIUM" className="bg-neutral-900">Medium (Balanced)</option>
                  <option value="HARD" className="bg-neutral-900">Hard (Advanced)</option>
                </select>
                {!isHost && (
                  <span className="text-[10px] text-gray-400 mt-1 block">Only the room host can change settings.</span>
                )}
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/10 text-xs text-gray-400">
                <span className="font-bold text-white block mb-1">Authoritative Server Rules</span>
                Turn timeout timer is enforced server-side. If a player runs out of time, a random legal move is automatically executed for them.
              </div>
            </div>
          </GlassCard>
        </div>

        <RulesModal isOpen={showRulesModal} onClose={() => setShowRulesModal(false)} />
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
      <div className="flex flex-col h-screen max-h-screen bg-black text-white select-none font-sans overflow-hidden">
        <GameHeader
          onBack={handleLeave}
          onOpenRules={() => setShowRulesModal(true)}
          turnExpiresAt={gameState.turnExpiresAt}
          turnTimeLeft={gameState.turnTimeLeft}
          isMyTurn={isMyTurn}
          status={gameState.status}
          isMuted={isMuted}
          onToggleMute={toggleMute}
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
            const socket = socketService.getSocket();
            socket.emit('game_action', { gameId: gameState.gameId, userId, action: 'play_again' });
          }}
          onExit={handleLeave}
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

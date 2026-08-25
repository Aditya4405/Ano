"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Play, UserPlus, LogOut, Loader2, Check, X,
  Volume2, VolumeX, MessageSquare, Award, ArrowLeft, Send, RefreshCw, Globe, Brain, Trophy, Crown, BookOpen,
  RotateCcw, Copy, Shield
} from "lucide-react";
import { useUserStore } from "@/store/useUserStore";
import { useRoomConnectionStore } from "@/store/useRoomConnectionStore";
import { useVoiceStore } from "@/store/useVoiceStore";
import { useMemoryMatchStore, LobbyPlayer, MemoryMatchGameState, PublicLobby, MemoryCard } from "@/store/useMemoryMatchStore";
import { GlassCard } from "@/components/layout/GlassCard";
import { ChatArea } from "@/components/room/ChatArea";
import { MessageInput } from "@/components/room/MessageInput";
import { socketService } from "@/lib/socket";
import { TurnIndicator } from "@/components/games/TurnIndicator";
import { API_URL } from "@/lib/config";
import { useExitWarning } from "@/hooks/useExitWarning";
import { useInviteCooldown } from "@/hooks/useInviteCooldown";
import { useGamePresence } from "@/hooks/useGamePresence";
import GameChatDrawer from "@/components/games/common/GameChatDrawer";
import { useGameChatStore } from "@/store/useGameChatStore";

// Unique colors for each player (up to 8)
const PLAYER_COLORS = [
  { bg: 'from-rose-500 to-pink-600',     border: 'border-rose-400/60',   shadow: 'shadow-[0_0_15px_rgba(244,63,94,0.4)]',   text: 'text-rose-400',    bgLight: 'bg-rose-500/20' },
  { bg: 'from-sky-500 to-cyan-600',       border: 'border-sky-400/60',    shadow: 'shadow-[0_0_15px_rgba(14,165,233,0.4)]',  text: 'text-sky-400',     bgLight: 'bg-sky-500/20' },
  { bg: 'from-emerald-500 to-green-600',  border: 'border-emerald-400/60', shadow: 'shadow-[0_0_15px_rgba(16,185,129,0.4)]', text: 'text-emerald-400', bgLight: 'bg-emerald-500/20' },
  { bg: 'from-amber-500 to-yellow-600',   border: 'border-amber-400/60',  shadow: 'shadow-[0_0_15px_rgba(245,158,11,0.4)]',  text: 'text-amber-400',   bgLight: 'bg-amber-500/20' },
  { bg: 'from-violet-500 to-purple-600',  border: 'border-violet-400/60', shadow: 'shadow-[0_0_15px_rgba(139,92,246,0.4)]',  text: 'text-violet-400',  bgLight: 'bg-violet-500/20' },
  { bg: 'from-orange-500 to-red-600',     border: 'border-orange-400/60', shadow: 'shadow-[0_0_15px_rgba(249,115,22,0.4)]',  text: 'text-orange-400',  bgLight: 'bg-orange-500/20' },
  { bg: 'from-teal-500 to-cyan-600',      border: 'border-teal-400/60',   shadow: 'shadow-[0_0_15px_rgba(20,184,166,0.4)]',  text: 'text-teal-400',    bgLight: 'bg-teal-500/20' },
  { bg: 'from-fuchsia-500 to-pink-600',   border: 'border-fuchsia-400/60', shadow: 'shadow-[0_0_15px_rgba(217,70,239,0.4)]', text: 'text-fuchsia-400', bgLight: 'bg-fuchsia-500/20' },
];

const BOARD_SIZE_LABELS: Record<number, string> = {
  2: '👶 Mini (2 Pairs / 4 Cards - 2×2)',
  3: '🐣 Micro (3 Pairs / 6 Cards - 2×3)',
  4: '🌱 Beginner (4 Pairs / 8 Cards - 2×4)',
  6: '⚡ Quick (6 Pairs / 12 Cards - 3×4)',
  8: '🎯 Classic (8 Pairs / 16 Cards - 4×4)',
  10: '✨ Casual (10 Pairs / 20 Cards - 4×5)',
  12: '🧠 Standard (12 Pairs / 24 Cards - 4×6)',
  14: '🍃 Warmup (14 Pairs / 28 Cards - 4×7)',
  15: '⚖️ Balanced (15 Pairs / 30 Cards - 5×6)',
  16: '🔥 Medium (16 Pairs / 32 Cards - 4×8)',
  18: '🏆 Arcade (18 Pairs / 36 Cards - 6×6)',
  20: '🌟 Pro (20 Pairs / 40 Cards - 5×8)',
  21: '⚔️ Advanced (21 Pairs / 42 Cards - 6×7)',
  24: '💎 Large (24 Pairs / 48 Cards - 6×8)',
  28: '🛡️ Heroic (28 Pairs / 56 Cards - 7×8)',
  30: '🔮 Expert (30 Pairs / 60 Cards - 6×10)',
  32: '👑 Giant (32 Pairs / 64 Cards - 8×8)',
  36: '🎪 Mega (36 Pairs / 72 Cards - 8×9)',
  40: '🌌 Master (40 Pairs / 80 Cards - 8×10)',
  48: '⚡ Grandmaster (48 Pairs / 96 Cards - 8×12)',
  50: '🚀 Insane (50 Pairs / 100 Cards - 10×10)',
  60: '💥 Godlike (60 Pairs / 120 Cards - 10×12)',
  72: '🪐 Impossible (72 Pairs / 144 Cards - 12×12)',
};

function getPlayerColorIndex(players: { userId: string }[], playerId: string): number {
  const idx = players.findIndex(p => p.userId === playerId);
  return idx >= 0 ? idx % PLAYER_COLORS.length : 0;
}

function MemoryMatchPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const gameIdParam = searchParams.get("gameId");

  const { id: userId, nickname, avatar } = useUserStore();
  const { currentRoomId } = useRoomConnectionStore();
  const { connectedChannelId, isMuted, toggleMute, disconnect: disconnectVoice } = useVoiceStore();
  const { unreadCount: unreadChatCount, toggleChat } = useGameChatStore();

  const {
    lobby,
    gameState,
    matchResult,
    error,
    availableLobbies,
    createLobby,
    joinLobby,
    toggleReady,
    kickPlayer,
    leaveLobby,
    invitePlayer,
    updateLobbySettings,
    startGame,
    flipCard,
    playAgain,
    clearState,
    setupListeners,
    fetchLobbies
  } = useMemoryMatchStore();

  // Track active game presence when match is running
  useGamePresence('MEMORY_MATCH', Boolean(gameState), gameState?.gameId);

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showChatSidebar, setShowChatSidebar] = useState(false);
  const [friendsList, setFriendsList] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
  const [roomMembers, setRoomMembers] = useState<any[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);

  const { triggerInvite, getInviteStatus } = useInviteCooldown(lobby?.id || gameState?.gameId);
  const { bypassWarning } = useExitWarning(!!lobby || !!gameState);

  const fetchOnlineUsers = useCallback(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/users/online`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setOnlineUsers(data.filter((u: any) => u.id !== userId)); })
      .catch(() => {});
  }, [userId]);

  const fetchFriends = useCallback(() => {
    if (!userId) return;
    fetch(`${API_URL}/api/notifications/friendships/${userId}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setFriendsList(data); })
      .catch(() => {});
  }, [userId]);

  const fetchRoomMembers = useCallback(() => {
    if (!currentRoomId) return;
    fetch(`${API_URL}/api/rooms/${currentRoomId}/users`)
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setRoomMembers(data.filter((u: any) => u.id !== userId)); })
      .catch(() => {});
  }, [userId, currentRoomId]);

  useEffect(() => {
    fetchOnlineUsers();
    fetchFriends();
    fetchRoomMembers();
  }, [fetchOnlineUsers, fetchFriends, fetchRoomMembers, lobby?.id]);

  // Setup listeners on mount
  useEffect(() => {
    if (!userId) return;
    const cleanup = setupListeners(lobby?.id || gameState?.gameId || "", userId);

    if (gameIdParam && lobby?.id !== gameIdParam && !gameState) {
      joinLobby(gameIdParam, userId, nickname || "Player");
    }

    return () => { cleanup(); };
  }, [userId, lobby?.id, gameState?.gameId, gameIdParam]);

  // Leave lobby on unmount
  useEffect(() => {
    return () => {
      const state = useMemoryMatchStore.getState();
      const currentGameId = state.lobby?.id || state.gameState?.gameId;
      const currentUserId = useUserStore.getState().id;
      if (currentGameId && currentUserId) {
        state.leaveLobby(currentGameId, currentUserId);
      }
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    const socket = socketService.getSocket();
    const doFetch = () => fetchLobbies();
    if (socket.connected) doFetch();
    socket.on('connect', doFetch);
    return () => { socket.off('connect', doFetch); };
  }, [userId]);

  const handleCopyLink = () => {
    const activeLobbyId = lobby?.id;
    if (!activeLobbyId) return;
    const url = `${window.location.origin}/dashboard/games/memory-match?gameId=${activeLobbyId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSendInvite = (targetUserId: string) => {
    const activeLobbyId = lobby?.id;
    if (!activeLobbyId || !userId) return;
    triggerInvite(targetUserId);
    invitePlayer(activeLobbyId, userId, nickname || 'Player', targetUserId);
  };

  const handleCreateLobby = () => {
    if (!userId || !nickname) return;
    createLobby(userId, nickname);
  };

  const handleFlipCard = (cardIndex: number) => {
    const activeGameId = gameState?.gameId;
    if (!activeGameId || !userId) return;
    flipCard(activeGameId, userId, cardIndex);
  };

  const handlePlayAgain = () => {
    const activeGameId = gameState?.gameId;
    if (!activeGameId || !userId) return;
    playAgain(activeGameId, userId);
  };

  const handleLeave = () => {
    bypassWarning();
    const activeGameId = gameState?.gameId || lobby?.id;
    if (activeGameId && userId) {
      leaveLobby(activeGameId, userId);
    }
    clearState();
    if (gameIdParam) {
      router.replace("/dashboard/games/memory-match");
    }
  };

  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);

  if (!isClient || !userId || !nickname) {
    return (
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      </div>
    );
  }

  const rulesModal = (
    <AnimatePresence>
      {showRulesModal && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in"
          onClick={() => setShowRulesModal(false)}
        >
          <motion.div 
            initial={{ y: 50, scale: 0.95 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 50, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-neutral-900 border border-white/10 rounded-3xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto text-left relative shadow-2xl custom-scrollbar"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2"><BookOpen className="w-6 h-6 text-violet-400" /> Memory Match Rules</h2>
              <button onClick={() => setShowRulesModal(false)} className="text-gray-400 hover:text-white p-1 hover:bg-white/10 rounded-md transition-colors cursor-pointer">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="space-y-4 text-gray-300 text-sm leading-relaxed">
              <p><strong className="text-white">Goal:</strong> Find and match pairs of cards. The player with the most matches at the end wins.</p>
              
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-violet-400 block mb-1">On Your Turn:</strong>
                <p>1. Flip over any card to reveal its symbol.</p>
                <p>2. Flip a second card. Try to match the first symbol.</p>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-violet-400 block mb-1">Flipping Results:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-1">
                  <li><strong>Successful Match:</strong> If both cards have the same symbol, they remain face up, you score a point, and you get to take another turn!</li>
                  <li><strong>Mismatch:</strong> If the symbols do not match, both cards are flipped back face down after a short delay, and the turn passes to the next player.</li>
                </ul>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <strong className="text-violet-400 block mb-1">Board Configurations:</strong>
                <p>Hosts can customize the game size in the Lobby settings by selecting from 22 distinct board sizes (from 2 pairs up to a giant 72-pair / 144-card board).</p>
              </div>
            </div>

            <button 
              onClick={() => setShowRulesModal(false)}
              className="mt-6 w-full py-3 bg-violet-600 hover:bg-violet-750 text-white rounded-xl font-bold transition-all shadow-lg shadow-violet-500/25 cursor-pointer"
            >
              Got it!
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  // ========================
  // PRE-LOBBY VIEW
  // ========================
  if (!lobby && !gameState) {
    const memoryLobbies = availableLobbies.filter(l => l.gameType === 'MEMORY_MATCH');
    return (
      <div className="flex flex-col min-h-screen bg-black text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/dashboard/games" className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Back to Arcade">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <img src="/ano-logo.png" alt="Ano Logo" className="w-8 h-8 object-contain group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-lg font-bold text-white tracking-wide">Ano</span>
            </Link>
            <div className="ml-1 sm:ml-2 border-l border-white/20 pl-3 sm:pl-4">
              <h1 className="text-base sm:text-lg md:text-xl font-bold text-white flex items-center gap-2">
                <span>🧠</span>
                <span className="truncate">Memory Match</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-3.5 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-2 transition-colors hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Rules</span>
            </button>
          </div>
        </div>

        {/* Main 2-Column Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Hero Banner & Open Lobbies */}
            <div className="lg:col-span-2 space-y-6">
              {/* Create Lobby Card */}
              <GlassCard className="p-6 sm:p-8 text-left relative overflow-hidden bg-gradient-to-br from-violet-950/40 via-neutral-900 to-black border border-violet-500/20">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
                  <div className="w-20 h-20 bg-gradient-to-br from-violet-500 to-fuchsia-600 rounded-3xl flex items-center justify-center text-4xl shadow-xl flex-shrink-0">
                    🧠
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-2xl font-bold text-white mb-1.5 flex items-center gap-2">
                      Memory Match Multiplayer
                    </h2>
                    <p className="text-sm text-gray-400 mb-4 leading-relaxed">
                      Flip cards, remember locations, and challenge your friends in real-time brain battles with up to 8 players!
                    </p>
                    <button
                      onClick={handleCreateLobby}
                      className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-xl font-bold text-white shadow-lg shadow-violet-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 cursor-pointer"
                    >
                      <Play className="w-4 h-4 fill-white" /> Create Private Lobby
                    </button>
                  </div>
                </div>
              </GlassCard>

              {/* Open Public Lobbies */}
              <div className="bg-white/5 border border-white/10 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Globe className="w-5 h-5 text-violet-400" />
                    Open Lobbies ({memoryLobbies.length})
                  </h3>
                  <button
                    onClick={fetchLobbies}
                    className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                    title="Refresh lobbies"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

                {memoryLobbies.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-sm space-y-1">
                    <p>No open lobbies right now.</p>
                    <p className="text-xs text-gray-600">Create a lobby and invite online players!</p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {memoryLobbies.map((l) => (
                      <div
                        key={l.id}
                        className="flex items-center justify-between p-3.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-violet-600/30 border border-violet-500/30 flex items-center justify-center font-bold text-violet-300 text-xs">
                            {l.hostName?.[0]?.toUpperCase() || 'H'}
                          </div>
                          <div>
                            <span className="font-semibold text-sm text-white block leading-tight">{l.hostName}&apos;s Game</span>
                            <span className="text-xs text-gray-400">
                              {l.playerCount}/{l.maxPlayers} players · {l.status === 'WAITING' ? 'Waiting' : 'In Game'}
                            </span>
                          </div>
                        </div>

                        <button
                          onClick={() => joinLobby(l.id, userId, nickname)}
                          className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md"
                        >
                          Join
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Online Players to Invite */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-violet-400" />
                  Online Players ({onlineUsers.length})
                </h3>
                <button
                  onClick={fetchOnlineUsers}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Refresh online users"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[420px] space-y-2.5 pr-1 custom-scrollbar">
                {onlineUsers.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-sm space-y-1">
                    <p>No other players online right now.</p>
                    <p className="text-xs text-gray-600">Create a lobby and share your link with friends!</p>
                  </div>
                ) : (
                  onlineUsers.map((u) => {
                    const isFriend = friendsList.some((f) => f.id === u.id);
                    const status = getInviteStatus(u.id);
                    return (
                      <div key={u.id} className="flex items-center justify-between p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
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
                          onClick={() => {
                            if (!lobby) {
                              handleCreateLobby();
                            } else {
                              handleSendInvite(u.id);
                            }
                          }}
                          disabled={!status.canInvite}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            !status.canInvite
                              ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 cursor-not-allowed'
                              : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md shadow-violet-500/20'
                          }`}
                        >
                          {status.canInvite ? 'Invite' : status.label}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
        {rulesModal}
      </div>
    );
  }

  // ========================
  // IN-LOBBY VIEW
  // ========================
  if (lobby && !gameState) {
    const isHost = lobby.hostId === userId;
    const players = lobby.players || [];
    const allReady = players.every(p => p.role === 'HOST' || p.isReady);
    const canStart = isHost && players.length >= 2 && allReady;

    return (
      <div className="flex flex-col min-h-screen bg-black text-white">
        {/* Top Header */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 flex-shrink-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3 sm:gap-4">
            <button onClick={handleLeave} className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer" title="Leave Lobby">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-base sm:text-xl font-bold flex items-center gap-2">
              <Brain className="w-5 h-5 sm:w-6 sm:h-6 text-violet-400" /> Memory Match Lobby
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChat}
              className="px-3 py-1.5 bg-white/5 border border-white/10 hover:border-violet-500/50 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors hover:bg-white/10 cursor-pointer relative"
              title="Lobby Chat"
            >
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span className="hidden sm:inline">Chat</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded-full animate-bounce">
                  {unreadChatCount}
                </span>
              )}
            </button>
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1.5 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors hover:bg-white/10 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-violet-400" /> <span className="hidden sm:inline">Rules</span>
            </button>
            <button 
              onClick={handleLeave} 
              className="px-3.5 py-1.5 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full text-xs sm:text-sm font-bold text-red-400 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">Leave</span>
            </button>
          </div>
        </div>

        {/* 3-Column Split Layout (2 Cols Left + 1 Col Right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 max-w-6xl w-full mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Lobby Info, Settings, Players */}
            <div className="lg:col-span-2 space-y-5">
              {/* Lobby Code & Copy Link */}
              <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3.5">
                <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Lobby Code</div>
                <code className="text-sm text-violet-400 font-mono flex-1 truncate">{lobby.id}</code>
                <button
                  onClick={handleCopyLink}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors cursor-pointer flex items-center gap-1.5 text-xs text-gray-300 border border-white/10"
                >
                  {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Match Settings (Visible to all players in lobby) */}
              <div className="bg-white/5 border border-white/10 rounded-xl p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                    <Brain className="w-4 h-4 text-violet-400" /> Match Settings
                  </div>
                  {!isHost && (
                    <span className="text-[11px] text-gray-400 font-medium">
                      Host controls settings
                    </span>
                  )}
                </div>
                <div>
                  <div className="text-xs text-gray-400 mb-2 font-medium">Board Size & Pair Count</div>
                  {isHost ? (
                    <select
                      value={lobby.settings?.pairCount || 12}
                      onChange={(e) => updateLobbySettings(lobby.id, userId, { pairCount: parseInt(e.target.value) })}
                      className="w-full bg-black/90 border border-white/20 rounded-lg px-3.5 py-2 text-sm outline-none focus:border-violet-500 text-white cursor-pointer font-medium"
                    >
                      <optgroup label="⚡ Quick & Casual (Fast Games)">
                        <option value={2}>👶 Mini (2 Pairs / 4 Cards - 2×2)</option>
                        <option value={3}>🐣 Micro (3 Pairs / 6 Cards - 2×3)</option>
                        <option value={4}>🌱 Beginner (4 Pairs / 8 Cards - 2×4)</option>
                        <option value={6}>⚡ Quick (6 Pairs / 12 Cards - 3×4)</option>
                        <option value={8}>🎯 Classic (8 Pairs / 16 Cards - 4×4)</option>
                      </optgroup>
                      <optgroup label="🧠 Standard & Balanced">
                        <option value={10}>✨ Casual (10 Pairs / 20 Cards - 4×5)</option>
                        <option value={12}>🧠 Standard (12 Pairs / 24 Cards - 4×6)</option>
                        <option value={14}>🍃 Warmup (14 Pairs / 28 Cards - 4×7)</option>
                        <option value={15}>⚖️ Balanced (15 Pairs / 30 Cards - 5×6)</option>
                        <option value={16}>🔥 Medium (16 Pairs / 32 Cards - 4×8)</option>
                        <option value={18}>🏆 Arcade (18 Pairs / 36 Cards - 6×6)</option>
                        <option value={20}>🌟 Pro (20 Pairs / 40 Cards - 5×8)</option>
                      </optgroup>
                      <optgroup label="🏆 Large & Challenging">
                        <option value={21}>⚔️ Advanced (21 Pairs / 42 Cards - 6×7)</option>
                        <option value={24}>💎 Large (24 Pairs / 48 Cards - 6×8)</option>
                        <option value={28}>🛡️ Heroic (28 Pairs / 56 Cards - 7×8)</option>
                        <option value={30}>🔮 Expert (30 Pairs / 60 Cards - 6×10)</option>
                        <option value={32}>👑 Giant (32 Pairs / 64 Cards - 8×8)</option>
                        <option value={36}>🎪 Mega (36 Pairs / 72 Cards - 8×9)</option>
                      </optgroup>
                      <optgroup label="🚀 Monumental & Insane">
                        <option value={40}>🌌 Master (40 Pairs / 80 Cards - 8×10)</option>
                        <option value={48}>⚡ Grandmaster (48 Pairs / 96 Cards - 8×12)</option>
                        <option value={50}>🚀 Insane (50 Pairs / 100 Cards - 10×10)</option>
                        <option value={60}>💥 Godlike (60 Pairs / 120 Cards - 10×12)</option>
                        <option value={72}>🪐 Impossible (72 Pairs / 144 Cards - 12×12)</option>
                      </optgroup>
                    </select>
                  ) : (
                    <div className="p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-violet-300 font-semibold flex items-center justify-between">
                      <span>{BOARD_SIZE_LABELS[lobby.settings?.pairCount || 12] || `${lobby.settings?.pairCount || 12} Pairs`}</span>
                      <span className="text-xs text-gray-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/5 font-medium">
                        {(lobby.settings?.pairCount || 12) * 2} Cards
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Player list */}
              <div className="space-y-2.5">
                <div className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  Players ({players.length}/8)
                </div>
                {players.map((p) => (
                  <div key={p.userId} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-3.5">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden shadow-inner">
                      {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : p.nickname?.[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-white text-sm flex items-center gap-2">
                        <span className="truncate">{p.nickname}</span>
                        {p.role === 'HOST' && <Crown className="w-4 h-4 text-yellow-400 flex-shrink-0" />}
                      </div>
                    </div>
                    <div className={`text-xs font-bold px-3 py-1 rounded-full ${
                      p.isReady || p.role === 'HOST' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-white/5 text-gray-400'
                    }`}>
                      {p.role === 'HOST' ? 'Host' : p.isReady ? 'Ready' : 'Waiting'}
                    </div>
                    {isHost && p.userId !== userId && (
                      <button
                        onClick={() => kickPlayer(lobby.id, userId, p.userId)}
                        className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors cursor-pointer"
                        title="Kick Player"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                {isHost ? (
                  <button
                    onClick={() => startGame(lobby.id, userId)}
                    disabled={!canStart}
                    className={`flex-1 px-5 py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      canStart
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg shadow-violet-500/25 hover:scale-[1.02] active:scale-95'
                        : 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                    }`}
                  >
                    <Play className="w-4 h-4 fill-white" /> Start Match
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      const me = players.find(p => p.userId === userId);
                      if (me) toggleReady(lobby.id, userId, !me.isReady);
                    }}
                    className={`flex-1 px-5 py-3.5 font-bold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      players.find(p => p.userId === userId)?.isReady
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                    {players.find(p => p.userId === userId)?.isReady ? 'Unready' : 'Ready Up'}
                  </button>
                )}
                <button
                  onClick={handleLeave}
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/10 text-gray-300 font-medium rounded-xl transition-colors border border-white/10 cursor-pointer"
                >
                  Leave
                </button>
              </div>
            </div>

            {/* Right Column: Online Players to Invite directly */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-violet-400" />
                  Invite Online Players
                </h3>
                <button
                  onClick={fetchOnlineUsers}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Refresh online users"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto max-h-[420px] space-y-2.5 pr-1 custom-scrollbar">
                {onlineUsers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 text-xs">
                    No other players online
                  </div>
                ) : (
                  onlineUsers
                    .filter((u) => !players.some((p) => p.userId === u.id))
                    .map((u) => {
                      const isFriend = friendsList.some((f) => f.id === u.id);
                      const status = getInviteStatus(u.id);
                      return (
                        <div key={u.id} className="flex items-center justify-between p-2.5 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-colors">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="relative shrink-0">
                              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-xs font-bold text-white overflow-hidden">
                                {u.avatar ? (
                                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  (u.nickname || '?')[0].toUpperCase()
                                )}
                              </div>
                              <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-neutral-900 bg-emerald-400" />
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-white block truncate">{u.nickname}</span>
                              <span className="text-[10px] text-gray-500 block">
                                {isFriend ? 'Friend' : 'Online'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleSendInvite(u.id)}
                            disabled={!status.canInvite}
                            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 ${
                              !status.canInvite
                                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30 cursor-not-allowed'
                                : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-md shadow-violet-500/20'
                            }`}
                          >
                            {status.canInvite ? 'Invite' : status.label}
                          </button>
                        </div>
                      );
                    })
                )}
                {onlineUsers.filter((u) => !players.some((p) => p.userId === u.id)).length === 0 && onlineUsers.length > 0 && (
                  <div className="text-xs text-gray-500 text-center py-4">
                    All online players are already in this lobby!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <GameChatDrawer
          gameId={lobby.id}
          currentUser={{ id: userId, nickname: nickname || 'Player', avatar }}
          title="Lobby Chat"
        />
        {rulesModal}
      </div>
    );
  }

  // ========================
  // GAME VIEW
  // ========================
  if (gameState) {
    const self = gameState.players.find(p => p.userId === userId);
    const isMyTurn = gameState.currentTurnPlayerId === userId;
    const currentTurnPlayer = gameState.players.find(p => p.userId === gameState.currentTurnPlayerId);
    const sortedPlayers = [...gameState.players].sort((a, b) => b.score - a.score);

    return (
      <div className="flex flex-col h-screen bg-black text-white">
        <TurnIndicator isMyTurn={isMyTurn} />
        {/* Top Bar */}
        <div className="flex items-center justify-between p-3 md:p-4 bg-white/5 border-b border-white/10 flex-shrink-0 z-30 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="flex items-center gap-3 cursor-pointer group hover:opacity-80 transition-opacity">
              <img src="/ano-logo.png" alt="Ano Logo" className="w-7 h-7 sm:w-8 sm:h-8 object-contain group-hover:scale-105 transition-transform flex-shrink-0" />
              <span className="text-base sm:text-lg font-bold text-white tracking-wide">Ano</span>
            </Link>
            <div className="border-l border-white/20 pl-3">
              <h1 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
                <span>🧠</span>
                <span className="truncate">Memory Match</span>
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-400">
            <button 
              onClick={() => setShowRulesModal(true)}
              className="px-3 py-1 bg-white/5 border border-white/10 text-gray-300 hover:text-white rounded-full font-bold text-xs flex items-center gap-1.5 transition-colors hover:bg-white/10"
            >
              <BookOpen className="w-3.5 h-3.5" /> Rules
            </button>
            <span>Pairs: <span className="text-violet-400 font-bold">{gameState.matchedPairs}/{gameState.totalPairs}</span></span>
            {gameState.status === 'PLAYING' && (
              <span className={`px-3 py-1 rounded-full font-bold text-xs ${isMyTurn ? 'bg-violet-500/30 text-violet-300 animate-pulse' : 'bg-white/10 text-gray-400'}`}>
                {isMyTurn ? "Your Turn" : `${currentTurnPlayer?.nickname}'s Turn`}
              </span>
            )}
          </div>
        </div>
        {rulesModal}

        <div className="flex-1 flex overflow-hidden">
          {/* Room Chat Sidebar (Collapsible) */}
          {currentRoomId && showChatSidebar && (
            <div className="w-80 border-r border-white/10 bg-neutral-900 flex flex-col">
              <div className="p-3 border-b border-white/10 flex items-center justify-between">
                <span className="text-sm font-bold">Room Chat</span>
                <button onClick={() => setShowChatSidebar(false)} className="text-gray-400 hover:text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-hidden">
                <ChatArea roomId={currentRoomId} />
              </div>
              <MessageInput roomId={currentRoomId} />
            </div>
          )}

          {/* Main Game Board */}
          <div className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-violet-950/30 via-gray-900 to-black overflow-hidden min-h-0 w-full">
            {/* Mobile mini-scores bar when scoreboard sidebar is hidden on < lg screens */}
            <div className="flex lg:hidden items-center justify-center gap-2 mb-2 w-full max-w-lg overflow-x-auto py-1 px-2 no-scrollbar flex-shrink-0">
              {sortedPlayers.map((p) => (
                <div
                  key={p.userId}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs flex-shrink-0 transition-all ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'bg-violet-500/30 border border-violet-400 text-white font-bold shadow-[0_0_10px_rgba(139,92,246,0.3)]'
                      : 'bg-white/5 border border-white/10 text-gray-400'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-gradient-to-br ${PLAYER_COLORS[getPlayerColorIndex(gameState.players, p.userId)].bg}`} />
                  <span className="truncate max-w-[80px]">{p.nickname}</span>
                  <span className="font-bold text-emerald-400">({p.score})</span>
                </div>
              ))}
            </div>

            <div className="relative w-full h-full flex items-center justify-center min-h-0">
              {/* Card Grid */}
              <div
                className="grid gap-1.5 sm:gap-2 md:gap-2.5 p-1 sm:p-2 items-center justify-center"
                style={{
                  gridTemplateColumns: `repeat(${gameState.boardCols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${gameState.boardRows}, minmax(0, 1fr))`,
                  maxHeight: 'calc(100vh - 150px)',
                  maxWidth: `min(100%, calc((100vh - 150px) * ${gameState.boardCols} / ${gameState.boardRows}))`,
                  aspectRatio: `${gameState.boardCols} / ${gameState.boardRows}`,
                  width: '100%',
                  height: 'auto',
                }}
              >
                {gameState.board.map((card) => {
                  const isRecentMatch = matchResult?.isMatch && (matchResult.cardIndex1 === card.index || matchResult.cardIndex2 === card.index);
                  const isRecentMismatch = matchResult && !matchResult.isMatch && (matchResult.cardIndex1 === card.index || matchResult.cardIndex2 === card.index);

                  const matchedColor = card.isMatched && card.matchedBy
                    ? PLAYER_COLORS[getPlayerColorIndex(gameState.players, card.matchedBy)]
                    : null;

                  return (
                    <motion.button
                      key={card.index}
                      onClick={() => handleFlipCard(card.index)}
                      disabled={card.isFlipped || card.isMatched || !isMyTurn || gameState.status !== 'PLAYING'}
                      className={`relative aspect-square w-full h-full rounded-xl sm:rounded-2xl cursor-pointer select-none transition-all duration-200 flex items-center justify-center
                        ${card.isMatched && matchedColor
                          ? `${matchedColor.bgLight} border-2 ${matchedColor.border} ${matchedColor.shadow} backdrop-blur-sm` 
                          : card.isFlipped 
                            ? 'bg-neutral-900 border-2 border-violet-400 shadow-[0_0_20px_rgba(139,92,246,0.5)]'
                            : isMyTurn && gameState.status === 'PLAYING'
                              ? 'bg-gradient-to-br from-violet-950/40 via-neutral-900 to-neutral-950 border-2 border-violet-500/50 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:border-violet-400 hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] hover:scale-[1.03] active:scale-95'
                              : 'bg-neutral-900/80 border-2 border-white/10 cursor-default'
                        }
                        ${isRecentMatch ? 'animate-bounce' : ''}
                        ${isRecentMismatch ? 'animate-[shake_0.3s_ease-in-out]' : ''}
                      `}
                      whileTap={isMyTurn && !card.isFlipped && !card.isMatched ? { scale: 0.92 } : {}}
                    >
                      <AnimatePresence mode="wait">
                        {(card.isFlipped || card.isMatched) && card.symbol ? (
                          <motion.div
                            key="front"
                            initial={{ rotateY: 90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: -90, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="absolute inset-0 flex items-center justify-center select-none filter drop-shadow-md"
                            style={{
                              fontSize: `clamp(1.1rem, min(calc(60vh / ${gameState.boardRows}), calc(60vw / ${gameState.boardCols})), 3.5rem)`,
                            }}
                          >
                            {card.symbol}
                          </motion.div>
                        ) : (
                          <motion.div
                            key="back"
                            initial={{ rotateY: -90, opacity: 0 }}
                            animate={{ rotateY: 0, opacity: 1 }}
                            exit={{ rotateY: 90, opacity: 0 }}
                            transition={{ duration: 0.22 }}
                            className="absolute inset-0 flex items-center justify-center p-1 sm:p-2"
                          >
                            <div className="w-full h-full max-w-[85%] max-h-[85%] rounded-lg sm:rounded-xl bg-gradient-to-br from-violet-600/25 via-fuchsia-600/20 to-violet-800/30 border border-violet-400/30 flex items-center justify-center shadow-inner group-hover:border-violet-400/60 transition-colors">
                              <span
                                className="text-violet-300/50 font-black select-none tracking-tighter"
                                style={{
                                  fontSize: `clamp(0.85rem, min(calc(30vh / ${gameState.boardRows}), calc(30vw / ${gameState.boardCols})), 2rem)`,
                                }}
                              >
                                ?
                              </span>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.button>
                  );
                })}
              </div>

              {/* Winner Overlay */}
              <AnimatePresence>
                {gameState.status === 'FINISHED' && (
                  <motion.div
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/70 backdrop-blur-md rounded-2xl flex flex-col items-center justify-center z-30"
                  >
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', damping: 15, stiffness: 200 }}>
                      <Trophy className="w-20 h-20 text-yellow-400 mb-4 mx-auto drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]" />
                    </motion.div>
                    {gameState.isDraw ? (
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        className="text-3xl font-black text-yellow-400 mb-2 text-center"
                      >
                        It&apos;s a Draw!
                      </motion.div>
                    ) : (
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        className="text-3xl font-black text-yellow-400 mb-2 text-center"
                      >
                        {gameState.players.find(p => p.userId === gameState.winnerId)?.nickname} Wins!
                      </motion.div>
                    )}
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}
                      className="text-gray-400 mb-6 text-center px-4"
                    >
                      {gameState.matchedPairs < gameState.totalPairs 
                        ? "The other players have left the game." 
                        : `All ${gameState.totalPairs} pairs found!`}
                    </motion.div>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <motion.button
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.7 }}
                        onClick={handlePlayAgain}
                        className="px-6 py-3 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 rounded-full font-bold text-sm text-white shadow-lg hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-2"
                      >
                        <RotateCcw className="w-4 h-4" /> Back to Lobby
                      </motion.button>
                      <motion.button
                        initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.8 }}
                        onClick={handleLeave}
                        className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/15 rounded-full font-bold text-sm text-gray-300 hover:text-white transition-all cursor-pointer flex items-center gap-2"
                      >
                        <LogOut className="w-4 h-4" /> Exit to Menu
                      </motion.button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right Sidebar — Scoreboard */}
          <div className="w-72 border-l border-white/10 bg-neutral-900 flex flex-col hidden lg:flex">
            <div className="p-3 border-b border-white/10 bg-black/20">
              <h2 className="font-bold text-sm tracking-wide uppercase flex items-center gap-2">
                <Award className="w-4 h-4 text-violet-400" /> Scoreboard
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
              {sortedPlayers.map((p, index) => (
                <motion.div
                  key={p.userId}
                  layout
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'bg-violet-500/20 border border-violet-400/30 shadow-[0_0_10px_rgba(139,92,246,0.2)]'
                      : 'bg-white/5 border border-white/5'
                  }`}
                >
                  <div className={`w-5 text-center font-black text-xs ${
                    index === 0 ? 'text-yellow-400' : index === 1 ? 'text-gray-300' : index === 2 ? 'text-amber-600' : 'text-white/30'
                  }`}>
                    {index === 0 ? <Crown className="w-4 h-4" /> : `#${index + 1}`}
                  </div>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold bg-gradient-to-br ${PLAYER_COLORS[getPlayerColorIndex(gameState.players, p.userId)].bg} ${
                    p.userId === gameState.currentTurnPlayerId
                      ? 'ring-2 ring-white/60 ring-offset-2 ring-offset-neutral-900'
                      : ''
                  }`}>
                    {p.nickname?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-xs truncate">
                      {p.nickname}
                      {p.userId === userId && <span className="text-violet-400 ml-1">(You)</span>}
                    </div>
                    <div className="text-[10px] text-white/40">
                      {!p.isOnline && '(Offline)'}
                      {p.userId === gameState.currentTurnPlayerId && <span className="text-violet-400">Playing...</span>}
                    </div>
                  </div>
                  <motion.div
                    key={p.score}
                    initial={{ scale: 1.3 }}
                    animate={{ scale: 1 }}
                    className="text-right"
                  >
                    <div className="font-black text-lg text-emerald-400">{p.score}</div>
                    <div className="text-[10px] text-white/30">pairs</div>
                  </motion.div>
                </motion.div>
              ))}
            </div>

            {/* Game Log */}
            <div className="border-t border-white/10 p-3 max-h-48 overflow-y-auto custom-scrollbar bg-black/20">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Game Log</h3>
              <div className="space-y-1">
                {gameState.historyLogs.slice(-10).reverse().map((log, i) => (
                  <div key={i} className="text-[11px] text-gray-500 leading-relaxed">{log}</div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="flex items-center justify-between p-2 md:p-3 bg-white/5 border-t border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={toggleChat}
              className="px-3 py-1.5 rounded-full bg-violet-600/30 hover:bg-violet-600/50 border border-violet-500/40 text-violet-200 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold relative"
              title="Open Match Chat"
            >
              <MessageSquare className="w-4 h-4 text-violet-400" />
              <span>Chat</span>
              {unreadChatCount > 0 && (
                <span className="px-1.5 py-0.2 text-[9px] font-black bg-rose-500 text-white rounded-full animate-bounce">
                  {unreadChatCount}
                </span>
              )}
            </button>
            {currentRoomId && (
              <button onClick={() => setShowChatSidebar(!showChatSidebar)} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors" title="Room Chat">
                <MessageSquare className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {connectedChannelId && (
              <>
                <button onClick={toggleMute} className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
                  {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                </button>
                <button onClick={disconnectVoice} className="p-2 rounded-full bg-red-500/20 hover:bg-red-500/40 text-red-400 transition-colors text-xs font-bold">
                  Disconnect
                </button>
              </>
            )}
          </div>
          <button onClick={handleLeave} className="px-4 py-2 bg-red-600/20 hover:bg-red-600/40 border border-red-500/30 rounded-full text-sm font-bold text-red-400 flex items-center gap-2 transition-colors">
            <LogOut className="w-4 h-4" /> Leave Game
          </button>
        </div>

        {/* In-Game Multiplayer Chat Drawer */}
        <GameChatDrawer
          gameId={gameState.gameId}
          currentUser={{ id: userId, nickname: nickname || 'Player', avatar }}
          title="Match Chat"
        />

        {/* Error Toast */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
              className="fixed bottom-20 left-1/2 -translate-x-1/2 bg-red-600/90 text-white px-6 py-3 rounded-full font-bold shadow-lg z-50"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  return null;
}

export default function MemoryMatchPage() {
  return (
    <Suspense fallback={
      <div className="flex h-screen bg-black items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
      </div>
    }>
      <MemoryMatchPageContent />
    </Suspense>
  );
}

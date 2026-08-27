'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, X, SendHorizontal, ChevronDown, 
  Phone, PhoneOff, Mic, MicOff, Volume2, VolumeX, Users, Radio
} from 'lucide-react';
import { useGameChatStore, GameChatMessage } from '@/store/useGameChatStore';
import { useVoiceStore } from '@/store/useVoiceStore';
import { useWebRTC } from '@/hooks/useWebRTC';

interface GameChatDrawerProps {
  gameId?: string | null;
  currentUser: {
    id: string;
    nickname: string;
    avatar?: string | null;
  };
  title?: string;
  className?: string;
  hideFloatingTrigger?: boolean;
}

function AudioPlayer({ stream }: { stream: MediaStream }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay playsInline />;
}

export default function GameChatDrawer({
  gameId,
  currentUser,
  title = 'Game Chat',
  className = '',
  hideFloatingTrigger = false
}: GameChatDrawerProps) {
  const [inputText, setInputText] = useState('');
  const [isScrolledUp, setIsScrolledUp] = useState(false);
  const [showVoiceMembers, setShowVoiceMembers] = useState(true);

  const {
    messages,
    isOpen,
    unreadCount,
    latestToastMessage,
    openChat,
    closeChat,
    toggleChat,
    clearToast,
    sendMessage,
    setupChatListeners
  } = useGameChatStore();

  const {
    connectedChannelId,
    connect: connectVoice,
    disconnect: disconnectVoice,
    isMuted,
    toggleMute,
    voiceError,
    setVoiceError
  } = useVoiceStore();

  const { globalVoiceUsers, activeSpeakers, streams } = useWebRTC();

  const isVoiceConnected = connectedChannelId === gameId;

  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Setup socket listeners for current gameId
  useEffect(() => {
    if (!gameId || !currentUser.id) return;
    const cleanup = setupChatListeners(gameId, currentUser.id);
    return () => {
      cleanup();
    };
  }, [gameId, currentUser.id, setupChatListeners]);

  // Click anywhere outside the chat drawer to close it
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      if (drawerRef.current && drawerRef.current.contains(target)) {
        return;
      }
      if (triggerRef.current && triggerRef.current.contains(target)) {
        return;
      }
      closeChat();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeChat();
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeChat]);

  // Auto-scroll when new messages arrive if user is not scrolled up
  useEffect(() => {
    if (!isScrolledUp) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isScrolledUp, isOpen]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen]);

  // Auto-dismiss preview toast after 4.5 seconds
  useEffect(() => {
    if (latestToastMessage) {
      const timer = setTimeout(() => {
        clearToast();
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [latestToastMessage, clearToast]);

  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    setIsScrolledUp(distanceToBottom > 80);
  };

  const isToastDraggingRef = useRef(false);

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !gameId) return;

    sendMessage(gameId, currentUser, inputText);
    setInputText('');
    setIsScrolledUp(false);
  };

  if (!gameId) return null;

  return (
    <>
      {/* Floating Preview Toast when chat is closed (Click to open, Swipe/Slide to dismiss) */}
      <AnimatePresence>
        {!isOpen && latestToastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 120, scale: 0.9, transition: { duration: 0.2 } }}
            drag="x"
            dragConstraints={{ left: -120, right: 250 }}
            dragElastic={0.6}
            onDragStart={() => {
              isToastDraggingRef.current = true;
            }}
            onDragEnd={(_, info) => {
              // If dragged/swiped horizontally past 50px or flicked quickly
              if (Math.abs(info.offset.x) > 50 || Math.abs(info.velocity.x) > 200) {
                clearToast();
              }
              setTimeout(() => {
                isToastDraggingRef.current = false;
              }, 60);
            }}
            onClick={() => {
              if (isToastDraggingRef.current) return;
              openChat();
            }}
            className="fixed bottom-20 right-4 sm:right-6 max-w-xs sm:max-w-sm bg-neutral-900/95 backdrop-blur-xl border border-violet-500/40 shadow-[0_10px_30px_rgba(139,92,246,0.3)] rounded-2xl p-3 z-50 cursor-grab active:cursor-grabbing hover:border-violet-400 transition-colors flex items-start gap-3 group touch-pan-y select-none"
          >
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0 overflow-hidden shadow-inner">
              {latestToastMessage.senderAvatar ? (
                <img src={latestToastMessage.senderAvatar} alt="" className="w-full h-full object-cover" />
              ) : (
                latestToastMessage.senderName[0]?.toUpperCase()
              )}
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-xs font-bold text-violet-300 truncate block leading-tight">
                {latestToastMessage.senderName}
              </span>
              <p className="text-xs text-gray-200 truncate mt-1 font-medium">
                {latestToastMessage.text}
              </p>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                clearToast();
              }}
              className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
              title="Dismiss notification"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      {!hideFloatingTrigger && (
        <button
          ref={triggerRef}
          onClick={toggleChat}
          className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 p-3 sm:px-4 sm:py-3 rounded-full flex items-center gap-2.5 shadow-[0_4px_25px_rgba(139,92,246,0.4)] transition-all cursor-pointer ${
            isOpen
              ? 'bg-neutral-800 border border-white/20 text-gray-300 hover:text-white'
              : 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white hover:scale-105 active:scale-95'
          }`}
          title="Toggle In-Game Chat"
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5" />
            {!isOpen && unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 px-1.5 py-0.5 text-[10px] font-black bg-rose-500 text-white rounded-full animate-bounce shadow-md min-w-[18px] text-center">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span className="hidden sm:inline text-xs font-bold uppercase tracking-wider">
            {isOpen ? 'Close Chat' : 'In-Game Chat'}
          </span>
        </button>
      )}

      {/* Slide-Out Chat Drawer / Floating Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={drawerRef}
            initial={{ opacity: 0, y: 40, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.96 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className={`fixed bottom-20 right-4 sm:right-6 w-[calc(100vw-2rem)] sm:w-96 h-[480px] max-h-[75vh] bg-neutral-950/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] z-50 flex flex-col overflow-hidden ${className}`}
          >
            {/* Drawer Header */}
            <div className="p-3.5 border-b border-white/10 bg-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-violet-400" /> {title}
                  </h3>
                </div>
              </div>
              <button
                onClick={closeChat}
                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                title="Close chat"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Hidden audio elements for WebRTC audio playback */}
            <div className="hidden">
              {Object.entries(streams).map(([peerId, stream]) => (
                <AudioPlayer key={peerId} stream={stream} />
              ))}
            </div>

            {/* Voice Error Alert */}
            {voiceError && (
              <div className="px-3.5 py-1.5 bg-rose-500/15 border-b border-rose-500/20 flex items-center justify-between text-xs text-rose-300">
                <span className="text-[11px] truncate">{voiceError}</span>
                <button
                  type="button"
                  onClick={() => setVoiceError(null)}
                  className="text-[10px] font-bold underline hover:text-white ml-2 cursor-pointer"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Voice Channel Call Bar */}
            {!isVoiceConnected ? (
              <div className="px-3.5 py-2.5 bg-gradient-to-r from-violet-950/40 via-neutral-900 to-fuchsia-950/40 border-b border-white/10 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-7 h-7 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 shrink-0">
                    <Phone className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>Voice Channel</span>
                      {globalVoiceUsers.length > 0 && (
                        <span className="px-1.5 py-0.2 text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full">
                          {globalVoiceUsers.length} in call
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-gray-400 truncate">
                      {globalVoiceUsers.length > 0
                        ? `${globalVoiceUsers.map((u) => u.nickname).join(', ')}`
                        : 'Talk live with players in this match'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setVoiceError(null);
                    connectVoice(gameId);
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
                >
                  <Phone className="w-3 h-3" />
                  <span>Join Call</span>
                </button>
              </div>
            ) : (
              <div className="px-3.5 py-2.5 bg-neutral-900/90 border-b border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                    <div>
                      <div className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                        <span>Voice Connected</span>
                        <span className="text-[10px] text-gray-400 font-normal">
                          ({globalVoiceUsers.length || 1})
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Voice Controls: Mic Mute & Disconnect */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={toggleMute}
                      className={`px-2.5 py-1 rounded-xl border text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                        isMuted
                          ? 'bg-rose-500/20 border-rose-500/40 text-rose-300 hover:bg-rose-500/30'
                          : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                      }`}
                      title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                      <span className="text-[10px]">{isMuted ? 'Muted' : 'Mute'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={disconnectVoice}
                      className="p-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 border border-rose-500/30 text-rose-300 hover:text-white transition-all cursor-pointer"
                      title="Leave voice call"
                    >
                      <PhoneOff className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Participants list in the active call */}
                <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 custom-scrollbar">
                  {(globalVoiceUsers.length > 0
                    ? globalVoiceUsers
                    : [{ userId: currentUser.id, nickname: currentUser.nickname }]
                  ).map((member) => {
                    const isSpeaking = activeSpeakers.includes(member.userId);
                    const isMe = member.userId === currentUser.id;
                    return (
                      <div
                        key={member.userId}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all text-xs shrink-0 ${
                          isSpeaking
                            ? 'bg-emerald-500/20 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.4)]'
                            : 'bg-white/5 border-white/10 text-gray-300'
                        }`}
                      >
                        <div
                          className={`w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[8px] font-bold text-white overflow-hidden ${
                            isSpeaking ? 'ring-2 ring-emerald-400 animate-pulse' : ''
                          }`}
                        >
                          {member.nickname?.[0]?.toUpperCase() || '?'}
                        </div>
                        <span className="text-[10px] font-medium truncate max-w-[80px]">
                          {member.nickname} {isMe && '(You)'}
                        </span>
                        {isMe && isMuted && (
                          <MicOff className="w-2.5 h-2.5 text-rose-400" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Messages Stream */}
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar relative"
            >
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-500 space-y-2 p-4">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-violet-400/60 border border-white/5">
                    <MessageSquare className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-semibold text-gray-400">No messages yet</p>
                  <p className="text-[11px] text-gray-500">Say hello or send a quick reaction to your lobby!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const isSelf = msg.senderId === currentUser.id;
                  const formattedTime = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  if (msg.system) {
                    return (
                      <div key={msg.id} className="text-center my-1.5">
                        <span className="text-[10px] text-gray-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">
                          {msg.text}
                        </span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id}
                      className={`flex items-start gap-2 ${isSelf ? 'flex-row-reverse' : 'flex-row'}`}
                    >
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0 overflow-hidden shadow-inner">
                        {msg.senderAvatar ? (
                          <img src={msg.senderAvatar} alt="" className="w-full h-full object-cover" />
                        ) : (
                          msg.senderName[0]?.toUpperCase()
                        )}
                      </div>

                      <div className={`max-w-[75%] space-y-0.5 ${isSelf ? 'items-end text-right' : 'items-start text-left'}`}>
                        <div className="flex items-center gap-1.5 px-1">
                          <span className="text-[10px] font-bold text-gray-300">
                            {isSelf ? 'You' : msg.senderName}
                          </span>
                          <span className="text-[9px] text-gray-500">{formattedTime}</span>
                        </div>

                        <div
                          className={`px-3 py-2 rounded-2xl text-xs leading-relaxed break-words shadow-sm font-medium ${
                            isSelf
                              ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-tr-none'
                              : 'bg-white/10 border border-white/10 text-gray-100 rounded-tl-none'
                          }`}
                        >
                          {msg.text}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Jump to Latest Floating Button */}
            {isScrolledUp && (
              <button
                onClick={() => {
                  messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                  setIsScrolledUp(false);
                }}
                className="absolute bottom-16 right-4 px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white text-[11px] font-bold rounded-full shadow-lg flex items-center gap-1 transition-all cursor-pointer z-10"
              >
                <ChevronDown className="w-3.5 h-3.5" /> New messages
              </button>
            )}

            {/* Input Footer */}
            <form onSubmit={handleSend} className="p-2.5 bg-black/80 border-t border-white/10 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                }}
                placeholder="Type a message..."
                maxLength={500}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder-gray-500 outline-none focus:border-violet-500 transition-colors"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="p-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:hover:bg-violet-600 text-white transition-all cursor-pointer flex-shrink-0 active:scale-95"
                title="Send message"
              >
                <SendHorizontal className="w-4 h-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

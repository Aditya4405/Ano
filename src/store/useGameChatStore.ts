import { create } from 'zustand';
import { socketService } from '@/lib/socket';

export interface GameChatMessage {
  id: string;
  gameId: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string | null;
  text: string;
  timestamp: number;
  system?: boolean;
}

interface GameChatStore {
  messages: GameChatMessage[];
  isOpen: boolean;
  unreadCount: number;
  latestToastMessage: GameChatMessage | null;

  // State setters
  openChat: () => void;
  closeChat: () => void;
  toggleChat: () => void;
  clearToast: () => void;
  clearChat: () => void;

  // Actions
  sendMessage: (
    gameId: string,
    user: { id: string; nickname: string; avatar?: string | null },
    text: string
  ) => void;

  // Listener setup
  setupChatListeners: (gameId: string, currentUserId: string) => () => void;
}

export const useGameChatStore = create<GameChatStore>((set, get) => ({
  messages: [],
  isOpen: false,
  unreadCount: 0,
  latestToastMessage: null,

  openChat: () => set({ isOpen: true, unreadCount: 0, latestToastMessage: null }),
  closeChat: () => set({ isOpen: false }),
  toggleChat: () =>
    set((state) => {
      const nextOpen = !state.isOpen;
      return {
        isOpen: nextOpen,
        unreadCount: nextOpen ? 0 : state.unreadCount,
        latestToastMessage: nextOpen ? null : state.latestToastMessage
      };
    }),

  clearToast: () => set({ latestToastMessage: null }),
  clearChat: () => set({ messages: [], unreadCount: 0, latestToastMessage: null }),

  sendMessage: (gameId, user, text) => {
    const trimmed = text.trim();
    if (!gameId || !user.id || !trimmed) return;

    const socket = socketService.getSocket();
    socket.emit('game_chat_send', {
      gameId,
      userId: user.id,
      nickname: user.nickname,
      avatar: user.avatar || null,
      text: trimmed
    });
  },

  setupChatListeners: (gameId, currentUserId) => {
    if (!gameId) return () => {};

    const socket = socketService.getSocket();

    const onChatMessage = (msg: GameChatMessage) => {
      if (msg.gameId !== gameId) return;

      set((state) => {
        // Prevent duplicate messages if any
        if (state.messages.some((m) => m.id === msg.id)) return state;

        const isSelf = msg.senderId === currentUserId;
        const newUnread = !state.isOpen && !isSelf ? state.unreadCount + 1 : 0;
        const toast = !state.isOpen && !isSelf ? msg : null;

        return {
          messages: [...state.messages, msg],
          unreadCount: newUnread,
          latestToastMessage: toast
        };
      });
    };

    const onChatHistory = (data: { gameId: string; messages: GameChatMessage[] }) => {
      if (data.gameId !== gameId) return;
      set({ messages: data.messages || [] });
    };

    socket.on('game_chat_message', onChatMessage);
    socket.on('game_chat_history', onChatHistory);

    // Request chat history upon subscribing
    socket.emit('game_chat_get_history', { gameId });

    return () => {
      socket.off('game_chat_message', onChatMessage);
      socket.off('game_chat_history', onChatHistory);
    };
  }
}));

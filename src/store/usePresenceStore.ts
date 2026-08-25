import { create } from 'zustand';

export type PresenceStatus = 'OFFLINE' | 'ONLINE' | 'PLAYING';

export interface GamePresence {
  gameId?: string | null;
  gameType: string;
  gameName: string;
  isSpectating?: boolean;
}

export interface UserPresence {
  userId: string;
  status: PresenceStatus;
  game?: GamePresence | null;
  updatedAt: number;
}

interface PresenceState {
  onlineUserIds: Set<string>;
  presences: Record<string, UserPresence>;

  setUserOnline: (userId: string) => void;
  setUserOffline: (userId: string) => void;
  setOnlineUsers: (userIds: string[]) => void;
  setPresence: (presence: UserPresence) => void;
  setBulkPresences: (presences: Record<string, UserPresence>) => void;

  isOnline: (userId: string) => boolean;
  isPlaying: (userId: string) => boolean;
  getPresence: (userId: string) => UserPresence | null;
  getGamePresence: (userId: string) => GamePresence | null;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  onlineUserIds: new Set<string>(),
  presences: {},

  setUserOnline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      updated.add(userId);

      const existingPres = state.presences[userId];
      const newPres: UserPresence = existingPres && existingPres.status === 'PLAYING'
        ? existingPres
        : {
            userId,
            status: 'ONLINE',
            game: null,
            updatedAt: Date.now(),
          };

      return {
        onlineUserIds: updated,
        presences: {
          ...state.presences,
          [userId]: newPres,
        },
      };
    }),

  setUserOffline: (userId) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      updated.delete(userId);

      const newPres: UserPresence = {
        userId,
        status: 'OFFLINE',
        game: null,
        updatedAt: Date.now(),
      };

      return {
        onlineUserIds: updated,
        presences: {
          ...state.presences,
          [userId]: newPres,
        },
      };
    }),

  setOnlineUsers: (userIds) =>
    set((state) => {
      const newSet = new Set(userIds);
      const newPresences = { ...state.presences };

      userIds.forEach((uId) => {
        if (!newPresences[uId] || newPresences[uId].status === 'OFFLINE') {
          newPresences[uId] = {
            userId: uId,
            status: 'ONLINE',
            game: null,
            updatedAt: Date.now(),
          };
        }
      });

      return {
        onlineUserIds: newSet,
        presences: newPresences,
      };
    }),

  setPresence: (presence) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      if (presence.status === 'OFFLINE') {
        updated.delete(presence.userId);
      } else {
        updated.add(presence.userId);
      }

      return {
        onlineUserIds: updated,
        presences: {
          ...state.presences,
          [presence.userId]: presence,
        },
      };
    }),

  setBulkPresences: (presencesMap) =>
    set((state) => {
      const updated = new Set(state.onlineUserIds);
      const merged = { ...state.presences };

      Object.values(presencesMap).forEach((p) => {
        if (p.status !== 'OFFLINE') {
          updated.add(p.userId);
        } else {
          updated.delete(p.userId);
        }
        merged[p.userId] = p;
      });

      return {
        onlineUserIds: updated,
        presences: merged,
      };
    }),

  isOnline: (userId) => {
    if (!userId) return false;
    const presence = get().presences[userId];
    if (presence) {
      return presence.status !== 'OFFLINE';
    }
    return get().onlineUserIds.has(userId);
  },

  isPlaying: (userId) => {
    if (!userId) return false;
    const presence = get().presences[userId];
    return presence ? presence.status === 'PLAYING' : false;
  },

  getPresence: (userId) => {
    if (!userId) return null;
    return get().presences[userId] || null;
  },

  getGamePresence: (userId) => {
    if (!userId) return null;
    const presence = get().presences[userId];
    return presence?.game || null;
  },
}));

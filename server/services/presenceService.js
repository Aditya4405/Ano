const userService = require('./userService');

// Central Game Display Names Map
const GAME_DISPLAY_NAMES = {
  // Uppercase keys
  'BLUFF': 'Bluff Card Game',
  'MEMORY_MATCH': 'Memory Match',
  'DOTS_AND_BOXES': 'Dots and Boxes',
  'COLOR_WARS': 'Chain Reaction',
  'SCRIBBLE': 'Scribble',
  'INK_DECEPTION': 'Ink & Deception',
  'CHAMBER_CLASH': 'Chamber Clash',
  'FLAPPY_BIRD': 'Flappy Bird',
  'FLAPPY': 'Flappy Bird',
  'PAPER_FALL': 'PaperFall',
  'ARROW_MAZE': 'Arrow Maze',
  'ULTIMATE_TIC_TAC_TOE': 'Ultimate Tic-Tac-Toe',
  '2048': '2048',
  'MINESWEEPER': 'Minesweeper',
  'CONNECT_FOUR': 'Connect 4',

  // Lowercase / slug keys
  'bluff': 'Bluff Card Game',
  'memory-match': 'Memory Match',
  'dots-and-boxes': 'Dots and Boxes',
  'color-wars': 'Chain Reaction',
  'scribble': 'Scribble',
  'ink-deception': 'Ink & Deception',
  'chamber-clash': 'Chamber Clash',
  'flappy-bird': 'Flappy Bird',
  'flappy': 'Flappy Bird',
  'paper-fall': 'PaperFall',
  'arrow-maze': 'Arrow Maze',
  'ultimate-tic-tac-toe': 'Ultimate Tic-Tac-Toe',
  'minesweeper': 'Minesweeper',
  'connect-four': 'Connect 4',
};

/**
 * Format any unknown gameType slug into Title Case
 * e.g. "space-invaders" -> "Space Invaders", "CHESS_3D" -> "Chess 3d"
 */
function resolveGameName(gameType) {
  if (!gameType) return 'Game';
  if (GAME_DISPLAY_NAMES[gameType]) return GAME_DISPLAY_NAMES[gameType];

  return gameType
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

class PresenceService {
  constructor() {
    // userId -> { userId, status: "OFFLINE"|"ONLINE"|"PLAYING", game: { gameId, gameType, gameName, isSpectating } | null, updatedAt }
    this.userPresences = new Map();

    // socketId -> { userId, gameId, gameType, isSpectating }
    this.socketPresences = new Map();

    // Reference to io instance (set on init)
    this.io = null;

    // Reference to onlineUsers map from server/index.js (userId -> Set<socketId>)
    this.onlineUsers = null;
  }

  init(io, onlineUsers) {
    this.io = io;
    this.onlineUsers = onlineUsers;
  }

  /**
   * Helper: Resolve game info
   */
  resolveGameInfo(gameType, gameId = null, isSpectating = false) {
    if (!gameType) return null;
    return {
      gameId: gameId || null,
      gameType,
      gameName: resolveGameName(gameType),
      isSpectating: Boolean(isSpectating),
    };
  }

  /**
   * Get current presence for a user
   */
  getPresence(userId) {
    if (!userId) return null;
    if (this.userPresences.has(userId)) {
      return this.userPresences.get(userId);
    }
    const isOnline = this.onlineUsers ? (this.onlineUsers.get(userId)?.size || 0) > 0 : false;
    return {
      userId,
      status: isOnline ? 'ONLINE' : 'OFFLINE',
      game: null,
      updatedAt: Date.now()
    };
  }

  /**
   * Get all active presences as an object Record<userId, UserPresence>
   */
  getAllPresences() {
    const result = {};
    for (const [uId, pres] of this.userPresences.entries()) {
      if (pres.status !== 'OFFLINE') {
        result[uId] = pres;
      }
    }
    return result;
  }

  /**
   * Broadcast a presence update to all connected sockets
   */
  broadcastPresence(presence) {
    if (!this.io || !presence) return;
    this.io.emit('presence_updated', presence);
    // Legacy event emission for any legacy listeners
    this.io.emit('user_presence_change', {
      userId: presence.userId,
      presenceStatus: presence.status === 'PLAYING' 
        ? `${presence.game?.isSpectating ? 'Spectating' : 'Playing'} ${presence.game?.gameName || 'a game'}`
        : (presence.status === 'ONLINE' ? 'Online' : null)
    });
  }

  /**
   * Mark user as ONLINE (when opening a tab or connecting)
   */
  /**
   * Mark user as ONLINE (when opening a tab or connecting)
   */
  async setOnline(userId, socketId) {
    if (!userId) return;

    // Check if user already has an active playing socket
    let existingGame = null;
    if (socketId && this.socketPresences.has(socketId)) {
      const sp = this.socketPresences.get(socketId);
      existingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
    } else if (this.onlineUsers && this.onlineUsers.has(userId)) {
      for (const sId of this.onlineUsers.get(userId)) {
        if (this.socketPresences.has(sId)) {
          const sp = this.socketPresences.get(sId);
          existingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
          break;
        }
      }
    }

    const current = this.userPresences.get(userId);
    if (!existingGame && current && current.status === 'PLAYING' && current.game) {
      existingGame = current.game;
    }

    const newStatus = existingGame ? 'PLAYING' : 'ONLINE';
    const newGame = existingGame || null;

    const presence = {
      userId,
      status: newStatus,
      game: newGame,
      updatedAt: Date.now()
    };

    this.userPresences.set(userId, presence);

    // Sync to DB
    const dbStatus = newStatus === 'PLAYING'
      ? `${newGame.isSpectating ? 'Spectating' : 'Playing'} ${newGame.gameName}`
      : 'Online';
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Set user as PLAYING a game session
   */
  async setPlaying(userId, socketId, { gameId, gameType, isSpectating = false }) {
    if (!userId) return;

    // Associate socket(s) with this game
    if (socketId) {
      this.socketPresences.set(socketId, { userId, gameId, gameType, isSpectating });
    }
    if (this.onlineUsers && this.onlineUsers.has(userId)) {
      for (const sId of this.onlineUsers.get(userId)) {
        this.socketPresences.set(sId, { userId, gameId, gameType, isSpectating });
      }
    }

    const game = this.resolveGameInfo(gameType, gameId, isSpectating);
    const presence = {
      userId,
      status: 'PLAYING',
      game,
      updatedAt: Date.now()
    };

    this.userPresences.set(userId, presence);

    // Sync to DB
    const dbStatus = `${isSpectating ? 'Spectating' : 'Playing'} ${game.gameName}`;
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    console.log(`[Presence] User ${userId} is now ${dbStatus} (gameId: ${gameId || 'solo'})`);
    this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Clear PLAYING status for a socket/user and return to ONLINE (or another active game if open in another tab)
   */
  async clearPlaying(userId, socketId = null, gameId = null) {
    if (!userId) return;

    if (socketId && this.socketPresences.has(socketId)) {
      this.socketPresences.delete(socketId);
    }

    // Check if user has another socket in an active game
    let remainingGame = null;
    if (this.onlineUsers && this.onlineUsers.has(userId)) {
      for (const sId of this.onlineUsers.get(userId)) {
        if (sId !== socketId && this.socketPresences.has(sId)) {
          const sp = this.socketPresences.get(sId);
          if (!gameId || sp.gameId !== gameId) {
            remainingGame = this.resolveGameInfo(sp.gameType, sp.gameId, sp.isSpectating);
            break;
          } else {
            // Also clean up this socket if it was for the same game
            this.socketPresences.delete(sId);
          }
        }
      }
    }

    const hasSockets = this.onlineUsers && this.onlineUsers.has(userId) && this.onlineUsers.get(userId).size > 0;
    const newStatus = remainingGame ? 'PLAYING' : (hasSockets ? 'ONLINE' : 'OFFLINE');
    const newGame = remainingGame || null;

    const presence = {
      userId,
      status: newStatus,
      game: newGame,
      updatedAt: Date.now()
    };

    this.userPresences.set(userId, presence);

    // Sync to DB
    const dbStatus = newStatus === 'PLAYING'
      ? `${newGame.isSpectating ? 'Spectating' : 'Playing'} ${newGame.gameName}`
      : (newStatus === 'ONLINE' ? 'Online' : null);
    userService.updatePresenceStatus(userId, dbStatus).catch(() => {});

    console.log(`[Presence] User ${userId} playing presence cleared -> status: ${newStatus}`);
    this.broadcastPresence(presence);
    return presence;
  }

  /**
   * Handle socket disconnect
   */
  async handleSocketDisconnect(userId, socketId) {
    if (socketId) {
      this.socketPresences.delete(socketId);
    }

    if (!userId) return;

    const userSockets = this.onlineUsers ? this.onlineUsers.get(userId) : null;
    const remainingCount = userSockets ? userSockets.size : 0;

    if (remainingCount === 0) {
      // User is completely offline
      const presence = {
        userId,
        status: 'OFFLINE',
        game: null,
        updatedAt: Date.now()
      };
      this.userPresences.delete(userId);
      userService.updatePresenceStatus(userId, null).catch(() => {});
      this.broadcastPresence(presence);
      return presence;
    } else {
      // User still has other open tabs
      return this.clearPlaying(userId, socketId);
    }
  }
}

const presenceService = new PresenceService();
module.exports = presenceService;
module.exports.GAME_DISPLAY_NAMES = GAME_DISPLAY_NAMES;
module.exports.resolveGameName = resolveGameName;

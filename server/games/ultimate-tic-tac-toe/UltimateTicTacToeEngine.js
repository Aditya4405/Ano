const BaseGameEngine = require('../engine/BaseGameEngine');
const GamePersistenceService = require('../services/GamePersistenceService');

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

class UltimateTicTacToeEngine extends BaseGameEngine {
  constructor(gameId) {
    super(gameId, 'ULTIMATE_TIC_TAC_TOE');

    this.settings = {
      turnTimer: 30,
      maxPlayers: 2,
    };

    this.currentPlayer = 'X';
    this.currentTurnPlayerId = null;
    this.playerSymbols = new Map(); // userId -> 'X' | 'O'

    this.miniBoards = Array(9).fill(null).map(() => Array(9).fill(null));
    this.wonBoards = Array(9).fill(null); // null, 'X', 'O', 'DRAW'
    this.miniBoardWinningLines = Array(9).fill(null); // boardIndex -> [c1, c2, c3] | null
    this.mainBoardWinningLine = null; // [b1, b2, b3] | null

    this.activeBoard = null; // null or 0..8
    this.isFreeMove = true;

    this.turnTimeLimit = 30;
    this.turnStartedAt = null;
    this.turnExpiresAt = null;
    this.timerIntervalId = null;
    this.isTimeoutProcessing = false;

    this.status = 'WAITING';
    this.winnerId = null;
    this.isDraw = false;
    this.historyLogs = [];
    this.stateVersion = 0;
    this.startTime = null;
  }

  startGame() {
    this.status = 'PLAYING';
    this.turnTimeLimit = this.settings.turnTimer || 30;
    this.stateVersion = 1;
    this.startTime = Date.now();

    const playerIds = Array.from(this.players.keys());
    this.playerSymbols = new Map();

    // Assign X to first player, O to second player
    if (playerIds.length >= 1) {
      this.playerSymbols.set(playerIds[0], 'X');
      const p1 = this.players.get(playerIds[0]);
      if (p1) p1.symbol = 'X';
    }
    if (playerIds.length >= 2) {
      this.playerSymbols.set(playerIds[1], 'O');
      const p2 = this.players.get(playerIds[1]);
      if (p2) p2.symbol = 'O';
    }

    this.currentPlayer = 'X';
    this.currentTurnPlayerId = playerIds[0] || null;

    this.miniBoards = Array(9).fill(null).map(() => Array(9).fill(null));
    this.wonBoards = Array(9).fill(null);
    this.miniBoardWinningLines = Array(9).fill(null);
    this.mainBoardWinningLine = null;

    this.activeBoard = null;
    this.isFreeMove = true;
    this.winnerId = null;
    this.isDraw = false;

    this.historyLogs = [
      {
        moveNumber: 0,
        playerId: 'system',
        symbol: '',
        boardIndex: -1,
        cellIndex: -1,
        timestamp: Date.now(),
        isTimeoutMove: false,
        text: 'Game started. Player X turn (Free Move).'
      }
    ];

    this.startTurnTimer();
    this.persistState();
  }

  startTurnTimer() {
    this.clearTurnTimer();
    this.turnStartedAt = Date.now();
    this.turnExpiresAt = this.turnStartedAt + (this.turnTimeLimit * 1000);
    this.isTimeoutProcessing = false;

    this.timerIntervalId = setInterval(() => {
      if (this.status !== 'PLAYING') {
        this.clearTurnTimer();
        return;
      }

      const now = Date.now();
      if (now >= this.turnExpiresAt && !this.isTimeoutProcessing) {
        this.isTimeoutProcessing = true;
        this.handleTimeout();
      } else if (this._broadcastCallback) {
        // Pulse state/timer update
        this._broadcastCallback();
      }
    }, 1000);
  }

  clearTurnTimer() {
    if (this.timerIntervalId) {
      clearInterval(this.timerIntervalId);
      this.timerIntervalId = null;
    }
  }

  handleTimeout() {
    if (this.status !== 'PLAYING' || !this.currentTurnPlayerId) return;

    const validMoves = this.getValidMoves();
    if (validMoves.length > 0) {
      const randomMove = validMoves[Math.floor(Math.random() * validMoves.length)];
      this.makeMove(this.currentTurnPlayerId, randomMove.boardIndex, randomMove.cellIndex, true);
    } else {
      this.clearTurnTimer();
    }
  }

  getValidMoves() {
    const validMoves = [];
    if (this.status !== 'PLAYING') return validMoves;

    for (let b = 0; b < 9; b++) {
      if (this.isBoardPlayable(b)) {
        if (this.isFreeMove || this.activeBoard === b) {
          for (let c = 0; c < 9; c++) {
            if (this.miniBoards[b][c] === null) {
              validMoves.push({ boardIndex: b, cellIndex: c });
            }
          }
        }
      }
    }
    return validMoves;
  }

  isBoardPlayable(boardIndex) {
    if (boardIndex < 0 || boardIndex > 8) return false;
    return this.wonBoards[boardIndex] === null && !this.isBoardFull(boardIndex);
  }

  isBoardFull(boardIndex) {
    if (boardIndex < 0 || boardIndex > 8) return false;
    return this.miniBoards[boardIndex].every(cell => cell !== null);
  }

  checkMiniBoardWinner(boardIndex) {
    const board = this.miniBoards[boardIndex];
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return combo;
      }
    }
    return null;
  }

  checkMainBoardWinner() {
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      const ownerA = this.wonBoards[a];
      const ownerB = this.wonBoards[b];
      const ownerC = this.wonBoards[c];

      if (ownerA && ownerA !== 'DRAW' && ownerA === ownerB && ownerA === ownerC) {
        return { winnerSymbol: ownerA, winningLine: combo };
      }
    }
    return null;
  }

  handlePlayerAction(playerId, action, data) {
    if (action === 'make_move') {
      return this.makeMove(playerId, data.boardIndex, data.cellIndex);
    }
    return { success: false, error: 'Unknown action' };
  }

  makeMove(playerId, boardIndex, cellIndex, isTimeoutMove = false) {
    // 1. Check game status
    if (this.status !== 'PLAYING') {
      return { success: false, error: 'Game is not in progress.' };
    }

    // 2. Check player belongs to game
    if (!this.players.has(playerId)) {
      return { success: false, error: 'You are not a participant in this game.' };
    }

    // 3. Check current turn player
    if (playerId !== this.currentTurnPlayerId) {
      return { success: false, error: 'It is not your turn.' };
    }

    // 4. Validate boardIndex and cellIndex bounds
    if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8) {
      return { success: false, error: 'Invalid board or cell position.' };
    }

    // 5. Validate active board / free move
    if (!this.isFreeMove && boardIndex !== this.activeBoard) {
      return { success: false, error: `You must play inside board ${this.activeBoard}.` };
    }

    // 6. Target board must be playable (unresolved and not full)
    if (!this.isBoardPlayable(boardIndex)) {
      return { success: false, error: 'Selected board is already won or full.' };
    }

    // 7. Cell must be empty
    if (this.miniBoards[boardIndex][cellIndex] !== null) {
      return { success: false, error: 'That cell is already occupied.' };
    }

    // Execute Move
    const symbol = this.playerSymbols.get(playerId) || this.currentPlayer;
    this.miniBoards[boardIndex][cellIndex] = symbol;

    // Check mini-board victory
    let miniBoardWon = false;
    let miniBoardDraw = false;
    const miniWinLine = this.checkMiniBoardWinner(boardIndex);

    if (miniWinLine) {
      this.wonBoards[boardIndex] = symbol;
      this.miniBoardWinningLines[boardIndex] = miniWinLine;
      miniBoardWon = true;
    } else if (this.isBoardFull(boardIndex)) {
      this.wonBoards[boardIndex] = 'DRAW';
      miniBoardDraw = true;
    }

    // Check main-board victory (CRITICAL: Checked BEFORE overall draw!)
    let mainBoardWon = false;
    const mainWin = this.checkMainBoardWinner();

    if (mainWin) {
      this.status = 'FINISHED';
      this.winnerId = playerId;
      this.isDraw = false;
      this.mainBoardWinningLine = mainWin.winningLine;
      mainBoardWon = true;
      this.clearTurnTimer();
    } else {
      // Check overall draw if no main board winner exists
      const allBoardsResolved = this.wonBoards.every(b => b !== null);
      if (allBoardsResolved) {
        this.status = 'FINISHED';
        this.winnerId = null;
        this.isDraw = true;
        this.clearTurnTimer();
      }
    }

    // Forced board calculation for next turn (if game still PLAYING)
    if (this.status === 'PLAYING') {
      const targetBoard = cellIndex;
      const targetResolved = this.wonBoards[targetBoard] !== null;
      const targetFull = this.isBoardFull(targetBoard);

      if (targetResolved || targetFull) {
        this.activeBoard = null;
        this.isFreeMove = true;
      } else {
        this.activeBoard = targetBoard;
        this.isFreeMove = false;
      }

      // Switch turn to next player
      this.advanceTurn();
      this.startTurnTimer();
    }

    this.stateVersion += 1;

    // Log move
    const player = this.players.get(playerId);
    const nickname = player ? player.nickname : 'Player';
    const moveLog = {
      moveNumber: this.historyLogs.length,
      playerId,
      symbol,
      boardIndex,
      cellIndex,
      timestamp: Date.now(),
      isTimeoutMove,
      miniBoardWon,
      miniBoardDraw,
      mainBoardWon,
      text: `${nickname} (${symbol}) played in Board ${boardIndex + 1}, Cell ${cellIndex + 1}${isTimeoutMove ? ' (Timeout Auto-Move)' : ''}${miniBoardWon ? ` and WON Board ${boardIndex + 1}!` : ''}`
    };

    this.historyLogs.push(moveLog);
    if (this.historyLogs.length > 20) {
      this.historyLogs.shift();
    }

    // Record persistence
    GamePersistenceService.recordMove(
      this.gameId,
      playerId,
      'ULTIMATE_TIC_TAC_TOE_MOVE',
      { boardIndex, cellIndex, symbol, isTimeoutMove }
    ).catch(console.error);

    if (this.status === 'FINISHED') {
      const durationSeconds = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
      GamePersistenceService.recordResult(this.gameId, this.winnerId, durationSeconds).catch(console.error);
    }

    this.persistState();

    if (this._broadcastCallback) {
      this._broadcastCallback();
    }

    return {
      success: true,
      broadcastEvent: {
        type: 'ultimate_tic_tac_toe_move_result',
        data: {
          playerId,
          symbol,
          boardIndex,
          cellIndex,
          miniBoardWon,
          miniBoardDraw,
          mainBoardWon,
          stateVersion: this.stateVersion
        }
      }
    };
  }

  advanceTurn() {
    const playerIds = Array.from(this.players.keys());
    if (playerIds.length <= 1) return;

    const currentIdx = playerIds.indexOf(this.currentTurnPlayerId);
    let nextIdx = (currentIdx + 1) % playerIds.length;
    let safety = 0;

    while (!this.players.get(playerIds[nextIdx])?.isOnline && safety < playerIds.length) {
      nextIdx = (nextIdx + 1) % playerIds.length;
      safety++;
    }

    this.currentTurnPlayerId = playerIds[nextIdx];
    this.currentPlayer = this.playerSymbols.get(this.currentTurnPlayerId) || (this.currentPlayer === 'X' ? 'O' : 'X');
  }

  removePlayer(userId) {
    if (!this.players.has(userId)) return false;

    const wasCurrentTurn = (this.currentTurnPlayerId === userId);
    this.players.delete(userId);

    if (this.players.size > 0 && wasCurrentTurn && this.status === 'PLAYING') {
      this.currentTurnPlayerId = Array.from(this.players.keys())[0];
      this.currentPlayer = this.playerSymbols.get(this.currentTurnPlayerId) || 'X';
      this.startTurnTimer();
    }

    if (this.players.size < 2 && this.status === 'PLAYING') {
      this.status = 'FINISHED';
      this.clearTurnTimer();
      const remainingWinner = Array.from(this.players.keys())[0] || null;
      this.winnerId = remainingWinner;
    }
    return true;
  }

  serializeState(privatePlayerId) {
    const playersList = [];
    this.players.forEach((p, id) => {
      playersList.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        symbol: this.playerSymbols.get(id) || p.symbol || 'X'
      });
    });

    const now = Date.now();
    const remainingTimerSeconds = this.turnExpiresAt ? Math.max(0, Math.ceil((this.turnExpiresAt - now) / 1000)) : this.turnTimeLimit;

    return {
      gameId: this.gameId,
      gameType: this.gameType,
      status: this.status,
      currentPlayer: this.currentPlayer,
      currentTurnPlayerId: this.currentTurnPlayerId,
      players: playersList,

      miniBoards: this.miniBoards,
      wonBoards: this.wonBoards,
      miniBoardWinningLines: this.miniBoardWinningLines,
      mainBoardWinningLine: this.mainBoardWinningLine,

      activeBoard: this.activeBoard,
      isFreeMove: this.isFreeMove,

      turnStartedAt: this.turnStartedAt,
      turnExpiresAt: this.turnExpiresAt,
      turnTimeLimit: this.turnTimeLimit,
      turnTimeLeft: remainingTimerSeconds,

      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs,
      stateVersion: this.stateVersion
    };
  }

  persistState() {
    const playersArr = [];
    this.players.forEach((p, id) => {
      playersArr.push({
        userId: p.userId,
        nickname: p.nickname,
        role: p.role,
        isReady: p.isReady,
        isOnline: p.isOnline,
        symbol: this.playerSymbols.get(id) || 'X'
      });
    });

    const fullState = {
      settings: this.settings,
      currentPlayer: this.currentPlayer,
      currentTurnPlayerId: this.currentTurnPlayerId,
      miniBoards: this.miniBoards,
      wonBoards: this.wonBoards,
      miniBoardWinningLines: this.miniBoardWinningLines,
      mainBoardWinningLine: this.mainBoardWinningLine,
      activeBoard: this.activeBoard,
      isFreeMove: this.isFreeMove,
      winnerId: this.winnerId,
      isDraw: this.isDraw,
      historyLogs: this.historyLogs,
      stateVersion: this.stateVersion,
      startTime: this.startTime,
      players: playersArr
    };

    GamePersistenceService.saveSessionState(this.gameId, fullState, this.status).catch(console.error);
  }

  restoreState(state) {
    this.settings = state.settings || { turnTimer: 30, maxPlayers: 2 };
    this.currentPlayer = state.currentPlayer || 'X';
    this.currentTurnPlayerId = state.currentTurnPlayerId || null;
    this.miniBoards = state.miniBoards || Array(9).fill(null).map(() => Array(9).fill(null));
    this.wonBoards = state.wonBoards || Array(9).fill(null);
    this.miniBoardWinningLines = state.miniBoardWinningLines || Array(9).fill(null);
    this.mainBoardWinningLine = state.mainBoardWinningLine || null;

    this.activeBoard = state.activeBoard !== undefined ? state.activeBoard : null;
    this.isFreeMove = state.isFreeMove !== undefined ? state.isFreeMove : true;

    this.winnerId = state.winnerId || null;
    this.isDraw = state.isDraw || false;
    this.historyLogs = state.historyLogs || [];
    this.stateVersion = state.stateVersion || 0;
    this.startTime = state.startTime || null;

    this.playerSymbols = new Map();
    if (state.players && Array.isArray(state.players)) {
      state.players.forEach(p => {
        this.players.set(p.userId, {
          userId: p.userId,
          nickname: p.nickname,
          role: p.role,
          isReady: p.isReady,
          isOnline: p.isOnline,
          symbol: p.symbol || 'X'
        });
        if (p.symbol) {
          this.playerSymbols.set(p.userId, p.symbol);
        }
      });
    }

    if (this.status === 'PLAYING') {
      this.startTurnTimer();
    }

    this.persistState();
  }
}

module.exports = UltimateTicTacToeEngine;

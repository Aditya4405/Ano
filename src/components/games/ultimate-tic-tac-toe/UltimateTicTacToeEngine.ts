import {
  checkMiniBoardWinner,
  checkMainBoardWinner,
  isBoardFull,
  isBoardPlayable,
  getNextBoardState,
  getValidMoves,
  WINNING_COMBINATIONS
} from './UltimateTicTacToeRules';

export type AiDifficulty = 'EASY' | 'MEDIUM' | 'HARD';

export interface LocalGameLog {
  moveNumber: number;
  symbol: 'X' | 'O';
  boardIndex: number;
  cellIndex: number;
  timestamp: number;
  miniBoardWon?: boolean;
  miniBoardDraw?: boolean;
  mainBoardWon?: boolean;
  text: string;
}

export interface LocalGameState {
  currentPlayer: 'X' | 'O';
  miniBoards: (string | null)[][];
  wonBoards: (string | null)[];
  miniBoardWinningLines: (number[] | null)[];
  mainBoardWinningLine: number[] | null;
  activeBoard: number | null;
  isFreeMove: boolean;
  status: 'PLAYING' | 'FINISHED';
  winner: 'X' | 'O' | null;
  isDraw: boolean;
  historyLogs: LocalGameLog[];
  turnTimeLeft: number;
}

export class SinglePlayerUt3Game {
  public state: LocalGameState;
  public aiDifficulty: AiDifficulty;
  public humanSymbol: 'X' | 'O' = 'X';
  public aiSymbol: 'X' | 'O' = 'O';

  constructor(aiDifficulty: AiDifficulty = 'MEDIUM') {
    this.aiDifficulty = aiDifficulty;
    this.state = this.createInitialState();
  }

  private createInitialState(): LocalGameState {
    return {
      currentPlayer: 'X',
      miniBoards: Array(9).fill(null).map(() => Array(9).fill(null)),
      wonBoards: Array(9).fill(null),
      miniBoardWinningLines: Array(9).fill(null),
      mainBoardWinningLine: null,
      activeBoard: null,
      isFreeMove: true,
      status: 'PLAYING',
      winner: null,
      isDraw: false,
      historyLogs: [
        {
          moveNumber: 0,
          symbol: 'X',
          boardIndex: -1,
          cellIndex: -1,
          timestamp: Date.now(),
          text: 'Practice match started. Select any cell to begin!'
        }
      ],
      turnTimeLeft: 30
    };
  }

  public resetGame(aiDifficulty?: AiDifficulty) {
    if (aiDifficulty) this.aiDifficulty = aiDifficulty;
    this.state = this.createInitialState();
  }

  public makeMove(boardIndex: number, cellIndex: number): boolean {
    if (this.state.status !== 'PLAYING') return false;
    if (boardIndex < 0 || boardIndex > 8 || cellIndex < 0 || cellIndex > 8) return false;
    if (!this.state.isFreeMove && boardIndex !== this.state.activeBoard) return false;
    if (!isBoardPlayable(boardIndex, this.state.wonBoards, this.state.miniBoards)) return false;
    if (this.state.miniBoards[boardIndex][cellIndex] !== null) return false;

    const symbol = this.state.currentPlayer;
    this.state.miniBoards[boardIndex][cellIndex] = symbol;

    let miniBoardWon = false;
    let miniBoardDraw = false;
    const miniWin = checkMiniBoardWinner(this.state.miniBoards[boardIndex]);

    if (miniWin) {
      this.state.wonBoards[boardIndex] = symbol;
      this.state.miniBoardWinningLines[boardIndex] = miniWin;
      miniBoardWon = true;
    } else if (isBoardFull(this.state.miniBoards[boardIndex])) {
      this.state.wonBoards[boardIndex] = 'DRAW';
      miniBoardDraw = true;
    }

    let mainBoardWon = false;
    const mainWin = checkMainBoardWinner(this.state.wonBoards);

    if (mainWin) {
      this.state.status = 'FINISHED';
      this.state.winner = mainWin.winnerSymbol;
      this.state.mainBoardWinningLine = mainWin.winningLine;
      this.state.isDraw = false;
      mainBoardWon = true;
    } else if (this.state.wonBoards.every(b => b !== null)) {
      this.state.status = 'FINISHED';
      this.state.winner = null;
      this.state.isDraw = true;
    }

    if (this.state.status === 'PLAYING') {
      const nextState = getNextBoardState(cellIndex, this.state.wonBoards, this.state.miniBoards);
      this.state.activeBoard = nextState.activeBoard;
      this.state.isFreeMove = nextState.isFreeMove;
      this.state.currentPlayer = symbol === 'X' ? 'O' : 'X';
      this.state.turnTimeLeft = 30;
    }

    const playerName = symbol === this.humanSymbol ? 'Player' : `AI (${this.aiDifficulty})`;
    this.state.historyLogs.push({
      moveNumber: this.state.historyLogs.length,
      symbol,
      boardIndex,
      cellIndex,
      timestamp: Date.now(),
      miniBoardWon,
      miniBoardDraw,
      mainBoardWon,
      text: `${playerName} (${symbol}) played in Board ${boardIndex + 1}, Cell ${cellIndex + 1}${miniBoardWon ? ` and WON Board ${boardIndex + 1}!` : ''}`
    });

    if (this.state.historyLogs.length > 20) {
      this.state.historyLogs.shift();
    }

    return true;
  }

  public computeAiMove(): { boardIndex: number; cellIndex: number } | null {
    if (this.state.status !== 'PLAYING' || this.state.currentPlayer !== this.aiSymbol) {
      return null;
    }

    const validMoves = getValidMoves(
      this.state.miniBoards,
      this.state.wonBoards,
      this.state.activeBoard,
      this.state.isFreeMove
    );

    if (validMoves.length === 0) return null;

    if (this.aiDifficulty === 'EASY') {
      return validMoves[Math.floor(Math.random() * validMoves.length)];
    }

    if (this.aiDifficulty === 'MEDIUM') {
      return this.computeMediumMove(validMoves);
    }

    return this.computeHardMove(validMoves);
  }

  private computeMediumMove(validMoves: { boardIndex: number; cellIndex: number }[]): { boardIndex: number; cellIndex: number } {
    // 1. Can AI win a mini board immediately?
    for (const move of validMoves) {
      const { boardIndex, cellIndex } = move;
      const copyBoard = [...this.state.miniBoards[boardIndex]];
      copyBoard[cellIndex] = this.aiSymbol;
      if (checkMiniBoardWinner(copyBoard)) {
        return move;
      }
    }

    // 2. Must AI block human from winning a mini board?
    for (const move of validMoves) {
      const { boardIndex, cellIndex } = move;
      const copyBoard = [...this.state.miniBoards[boardIndex]];
      copyBoard[cellIndex] = this.humanSymbol;
      if (checkMiniBoardWinner(copyBoard)) {
        return move;
      }
    }

    // 3. Prefer center/corners of mini-boards
    const preferredCells = [4, 0, 2, 6, 8, 1, 3, 5, 7];
    for (const cellPref of preferredCells) {
      const match = validMoves.find(m => m.cellIndex === cellPref);
      if (match) return match;
    }

    return validMoves[Math.floor(Math.random() * validMoves.length)];
  }

  private computeHardMove(validMoves: { boardIndex: number; cellIndex: number }[]): { boardIndex: number; cellIndex: number } {
    let bestScore = -Infinity;
    let bestMove = validMoves[0];

    const maxDepth = validMoves.length > 25 ? 3 : 4;

    for (const move of validMoves) {
      const { boardIndex, cellIndex } = move;

      // Make temporary move
      const originalCell = this.state.miniBoards[boardIndex][cellIndex];
      const originalWonBoard = this.state.wonBoards[boardIndex];
      const originalActiveBoard = this.state.activeBoard;
      const originalFreeMove = this.state.isFreeMove;

      this.state.miniBoards[boardIndex][cellIndex] = this.aiSymbol;
      if (checkMiniBoardWinner(this.state.miniBoards[boardIndex])) {
        this.state.wonBoards[boardIndex] = this.aiSymbol;
      } else if (isBoardFull(this.state.miniBoards[boardIndex])) {
        this.state.wonBoards[boardIndex] = 'DRAW';
      }

      const nextBoardState = getNextBoardState(cellIndex, this.state.wonBoards, this.state.miniBoards);
      this.state.activeBoard = nextBoardState.activeBoard;
      this.state.isFreeMove = nextBoardState.isFreeMove;

      const score = this.minimax(maxDepth - 1, false, -Infinity, Infinity);

      // Undo move
      this.state.miniBoards[boardIndex][cellIndex] = originalCell;
      this.state.wonBoards[boardIndex] = originalWonBoard;
      this.state.activeBoard = originalActiveBoard;
      this.state.isFreeMove = originalFreeMove;

      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }

    return bestMove;
  }

  private minimax(depth: number, isMaximizing: boolean, alpha: number, beta: number): number {
    const mainWin = checkMainBoardWinner(this.state.wonBoards);
    if (mainWin) {
      return mainWin.winnerSymbol === this.aiSymbol ? 10000 + depth : -10000 - depth;
    }

    if (this.state.wonBoards.every(b => b !== null) || depth === 0) {
      return this.evaluateHeuristicState();
    }

    const currentSymbol = isMaximizing ? this.aiSymbol : this.humanSymbol;
    const moves = getValidMoves(this.state.miniBoards, this.state.wonBoards, this.state.activeBoard, this.state.isFreeMove);

    if (moves.length === 0) return 0;

    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const move of moves) {
        const { boardIndex, cellIndex } = move;
        const origCell = this.state.miniBoards[boardIndex][cellIndex];
        const origWon = this.state.wonBoards[boardIndex];
        const origActive = this.state.activeBoard;
        const origFree = this.state.isFreeMove;

        this.state.miniBoards[boardIndex][cellIndex] = currentSymbol;
        if (checkMiniBoardWinner(this.state.miniBoards[boardIndex])) {
          this.state.wonBoards[boardIndex] = currentSymbol;
        } else if (isBoardFull(this.state.miniBoards[boardIndex])) {
          this.state.wonBoards[boardIndex] = 'DRAW';
        }

        const nextB = getNextBoardState(cellIndex, this.state.wonBoards, this.state.miniBoards);
        this.state.activeBoard = nextB.activeBoard;
        this.state.isFreeMove = nextB.isFreeMove;

        const evalScore = this.minimax(depth - 1, false, alpha, beta);

        this.state.miniBoards[boardIndex][cellIndex] = origCell;
        this.state.wonBoards[boardIndex] = origWon;
        this.state.activeBoard = origActive;
        this.state.isFreeMove = origFree;

        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const move of moves) {
        const { boardIndex, cellIndex } = move;
        const origCell = this.state.miniBoards[boardIndex][cellIndex];
        const origWon = this.state.wonBoards[boardIndex];
        const origActive = this.state.activeBoard;
        const origFree = this.state.isFreeMove;

        this.state.miniBoards[boardIndex][cellIndex] = currentSymbol;
        if (checkMiniBoardWinner(this.state.miniBoards[boardIndex])) {
          this.state.wonBoards[boardIndex] = currentSymbol;
        } else if (isBoardFull(this.state.miniBoards[boardIndex])) {
          this.state.wonBoards[boardIndex] = 'DRAW';
        }

        const nextB = getNextBoardState(cellIndex, this.state.wonBoards, this.state.miniBoards);
        this.state.activeBoard = nextB.activeBoard;
        this.state.isFreeMove = nextB.isFreeMove;

        const evalScore = this.minimax(depth - 1, true, alpha, beta);

        this.state.miniBoards[boardIndex][cellIndex] = origCell;
        this.state.wonBoards[boardIndex] = origWon;
        this.state.activeBoard = origActive;
        this.state.isFreeMove = origFree;

        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  }

  private evaluateHeuristicState(): number {
    let score = 0;

    // Mini board ownership values
    const boardWeights = [1.2, 1.0, 1.2, 1.0, 1.5, 1.0, 1.2, 1.0, 1.2]; // Center board (index 4) has highest weight

    for (let b = 0; b < 9; b++) {
      if (this.state.wonBoards[b] === this.aiSymbol) {
        score += 300 * boardWeights[b];
      } else if (this.state.wonBoards[b] === this.humanSymbol) {
        score -= 300 * boardWeights[b];
      }
    }

    // Main board 2-in-a-row threats
    for (const combo of WINNING_COMBINATIONS) {
      const [a, b, c] = combo;
      const owners = [this.state.wonBoards[a], this.state.wonBoards[b], this.state.wonBoards[c]];
      const aiCount = owners.filter(o => o === this.aiSymbol).length;
      const huCount = owners.filter(o => o === this.humanSymbol).length;

      if (aiCount === 2 && huCount === 0) score += 150;
      if (huCount === 2 && aiCount === 0) score -= 150;
    }

    return score;
  }
}

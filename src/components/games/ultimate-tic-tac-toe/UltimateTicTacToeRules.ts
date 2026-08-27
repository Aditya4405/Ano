export const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

export function checkMiniBoardWinner(board: (string | null)[]): number[] | null {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combo;
    }
  }
  return null;
}

export function isBoardFull(board: (string | null)[]): boolean {
  return board.every(cell => cell !== null);
}

export function checkMainBoardWinner(wonBoards: (string | null)[]): { winnerSymbol: 'X' | 'O'; winningLine: number[] } | null {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    const ownerA = wonBoards[a];
    const ownerB = wonBoards[b];
    const ownerC = wonBoards[c];

    if (ownerA && ownerA !== 'DRAW' && ownerA === ownerB && ownerA === ownerC) {
      return { winnerSymbol: ownerA as 'X' | 'O', winningLine: combo };
    }
  }
  return null;
}

export function isBoardPlayable(boardIndex: number, wonBoards: (string | null)[], miniBoards: (string | null)[][]): boolean {
  if (boardIndex < 0 || boardIndex > 8) return false;
  return wonBoards[boardIndex] === null && !isBoardFull(miniBoards[boardIndex]);
}

export function getNextBoardState(
  cellIndex: number,
  wonBoards: (string | null)[],
  miniBoards: (string | null)[][]
): { activeBoard: number | null; isFreeMove: boolean } {
  const targetBoard = cellIndex;
  const boardIsResolved = wonBoards[targetBoard] !== null;
  const boardIsFull = isBoardFull(miniBoards[targetBoard]);

  if (boardIsResolved || boardIsFull) {
    return { activeBoard: null, isFreeMove: true };
  }
  return { activeBoard: targetBoard, isFreeMove: false };
}

export function getValidMoves(
  miniBoards: (string | null)[][],
  wonBoards: (string | null)[],
  activeBoard: number | null,
  isFreeMove: boolean
): { boardIndex: number; cellIndex: number }[] {
  const validMoves: { boardIndex: number; cellIndex: number }[] = [];

  for (let b = 0; b < 9; b++) {
    if (isBoardPlayable(b, wonBoards, miniBoards)) {
      if (isFreeMove || activeBoard === b) {
        for (let c = 0; c < 9; c++) {
          if (miniBoards[b][c] === null) {
            validMoves.push({ boardIndex: b, cellIndex: c });
          }
        }
      }
    }
  }
  return validMoves;
}

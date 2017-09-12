import {
  setPawn, nextPlayer, removePawnFromHand, setNextMoveText, setMillInBox,
  changeActionType, highlightAvailablePawns, removePawnFromBoard, cleanHighlightedPawns,
  cachePawnPosition, highlightAvailableBox, removeMillInBox, highlightAllAvailableBoxes,
  setWinner, decreasePawnsFromBoard, Action
} from './game.actions';
import { putPawnMessage, removePawnMessage, selectPawnMessage, movePawnMessage,
  setWinnerMessage } from './game.messages';
import {
  PLAYER1, PLAYER2, PUT_ACTION, TAKE_ACTION, MOVE_ACTION, SELECT_TO_MOVE,
  TAKE_AFTER_MOVE_ACTION, SELECT_TO_JUMP, END_GAME, GameState, SimpleCell
} from './game.helpers';
import { Board, BoardCell } from './board.generator';
import { path, evolve, inc, append, assocPath, pipe, map, unnest } from 'ramda';

interface PawnCounter {
  counter: number;
  boxes: number[][];
}

interface MillObject {
  N: PawnCounter;
  S: PawnCounter;
  W: PawnCounter;
  E: PawnCounter;
}

function getNextBox(board: Board, currentBox: BoardCell, direction: string): BoardCell {
  const tempBox = {
    N: path([currentBox.column, currentBox.row - 1]),
    S: path([currentBox.column, currentBox.row + 1]),
    E: path([currentBox.column + 1, currentBox.row]),
    W: path([currentBox.column - 1, currentBox.row]),
  };
  return tempBox[direction](board);
}

function countPawnsInLine(
  board: Board,
  player: string,
  selectedBox: BoardCell,
  direction: string,
  acc: PawnCounter = { counter: 0, boxes: [] }
): PawnCounter {
  let newAcc = acc;
  if (selectedBox.pawn === player) {
    newAcc = evolve(
      {
        counter: inc,
        boxes: append([selectedBox.column, selectedBox.row])
      },
      newAcc
    );
  }
  if (!selectedBox[direction]) {
    return newAcc;
  }

  return countPawnsInLine(board, player, getNextBox(board, selectedBox, direction), direction, newAcc);
}

function findMill(board: Board, selectedBox: BoardCell, player: string, cachedPawn?: BoardCell): MillObject {
  const newBoard = cachedPawn ?
    assocPath([cachedPawn.column, cachedPawn.row, 'pawn'], undefined, board)
    : board;
  return {
    N: countPawnsInLine(newBoard, player, selectedBox, 'N'),
    S: countPawnsInLine(newBoard, player, selectedBox, 'S'),
    E: countPawnsInLine(newBoard, player, selectedBox, 'E'),
    W: countPawnsInLine(newBoard, player, selectedBox, 'W'),
  };
}

function isLineMill(millObject: MillObject, direction1: string, direction2: string, millSize: number): boolean {
  return path<number>([direction1, 'counter'], millObject) +
    path<number>([direction2, 'counter'], millObject) >=
    (millSize - 1);
}

function setMillInBoxes(millObject: MillObject, direction: string): Action[] {
  return pipe(
    path([direction, 'boxes']),
    map(item => setMillInBox({ column: item[0], row: item[1] }))
  )(millObject);
}

function countAvailablePawns(board: Board, player: string): number {
  return board
    .reduce(
      (accPar, currPar) =>
        currPar.reduce(
          (acc, curr) =>
            curr.pawn === player && curr.isInMill === 0 ? acc + 1 : acc,
          accPar),
      0);
}

function findAvailableBox(
  board: Board, selectedBox: BoardCell, direction: string
): SimpleCell {
  const newBox = getNextBox(board, selectedBox, direction);
  if (!newBox || !selectedBox[direction]) {
    return { column: -1, row: -1 };
  }
  if (newBox.isPawnBox && !newBox.pawn) {
    return {
      column: newBox.column,
      row: newBox.row,
    };
  }

  if (newBox.isPawnBox && !!newBox.pawn) {
    return { column: -1, row: -1 };
  }

  return findAvailableBox(board, newBox, direction);
}

function findAvailableBoxes(board: Board, selectedBox: BoardCell): Action[] {
  return [
    findAvailableBox(board, selectedBox, 'N'),
    findAvailableBox(board, selectedBox, 'S'),
    findAvailableBox(board, selectedBox, 'E'),
    findAvailableBox(board, selectedBox, 'W'),
  ]
    .filter(({ column, row }) => column !== -1 && row !== -1)
    .map(({ column, row }) => highlightAvailableBox({ column, row }));
}

function findExistedMill(
  board: Board, selectedBox: BoardCell, direction: string, acc: SimpleCell[] = []
): SimpleCell[] {
  const newBox = getNextBox(board, selectedBox, direction);
  let newAcc = acc;
  if (!newBox || !selectedBox[direction]) {
    return newAcc;
  }
  if (newBox.isInMill > 0) {
    newAcc = [...acc, {
      column: newBox.column,
      row: newBox.row,
    }];
  }

  return findExistedMill(board, newBox, direction, newAcc);
}

function removeMillOnTheBoard(board: Board, selectedBox: BoardCell): Action[] {
  return pipe(
    unnest,
    map((item: SimpleCell) => removeMillInBox({ column: item.column, row: item.row }))
  )([
    findExistedMill(board, selectedBox, 'N'),
    findExistedMill(board, selectedBox, 'S'),
    findExistedMill(board, selectedBox, 'E'),
    findExistedMill(board, selectedBox, 'W'),
  ]);
}

function findMillOnTheBoard(
  board: Board, selectedBox: BoardCell, player: string, millSize: number, cachedPawn?: BoardCell
): Action[] {
  const millObject = findMill(board, selectedBox, player, cachedPawn);
  const isVerticalMill = isLineMill(millObject, 'N', 'S', millSize);
  const isHorizontalMill = isLineMill(millObject, 'E', 'W', millSize);

  if (isVerticalMill) {
    return [...setMillInBoxes(millObject, 'N'), ...setMillInBoxes(millObject, 'S')];
  }

  if (isHorizontalMill) {
    return [...setMillInBoxes(millObject, 'E'), ...setMillInBoxes(millObject, 'W')];
  }
  return [];
}

function handleTakeMove(
  board: Board, opponent: string, column: number, row: number, playerName: string, action: string
): Action[] {
  const availableOpponentPawns = countAvailablePawns(board, opponent);

  if (availableOpponentPawns > 0) {
    return [
      setMillInBox({ column, row }),
      setNextMoveText({ text: removePawnMessage(playerName) }),
      changeActionType({ type: action }),
      highlightAvailablePawns({ player: opponent }),
    ];
  }
  return [];
}

const moveOrJump = (pawns: number) => pawns === 3 ? SELECT_TO_JUMP : SELECT_TO_MOVE;

export function gameLogic(row: number, column: number, state: GameState): Action[] {
  const player: string = path(['game', 'currentPlayer'], state);
  const opponent = player === PLAYER1 ? PLAYER2 : PLAYER1;
  const pawnsInHand: number = path(['game', player, 'pawnsInHand'], state);
  const opponentPawnsInHand: number = path(['game', opponent, 'pawnsInHand'], state);
  const pawnsOnBoard: number = path(['game', player, 'pawnsOnBoard'], state);
  const opponentPawnsOnBoard: number = path(['game', opponent, 'pawnsOnBoard'], state);
  const opponentName: string = path(['game', opponent, 'name'], state);
  const playerName: string = path(['game', player, 'name'], state);
  const board: Board = path(['game', 'board'], state);
  const millSize: number = path(['game', 'millSize'], state);
  const currentAction: string = path(['game', 'currentAction'], state);
  const selectedBox: BoardCell = path([column, row], board);
  const cachedPawn: BoardCell = path(['game', 'cacheSelectedPawn'], state);

  let returnedActions: Action[] = [];

  if (pawnsInHand > 0 && currentAction === PUT_ACTION && !selectedBox.pawn) {
    returnedActions.push(setPawn({ row, column }));
    returnedActions.push(removePawnFromHand({ player }));
    if (pawnsInHand <= 7) {
      const foundMill = findMillOnTheBoard(board, selectedBox, player, millSize);
      returnedActions = returnedActions.concat(foundMill);

      if (foundMill.length) {
        returnedActions = returnedActions.concat(handleTakeMove(board, opponent, column, row, playerName, TAKE_ACTION));
      } else {
        returnedActions.push(setNextMoveText({ text: putPawnMessage(opponentName) }));
        returnedActions.push(nextPlayer());
      }
      if (opponentPawnsInHand === 0 && pawnsInHand === 1 && !foundMill.length) {
        returnedActions.push(changeActionType({ type: SELECT_TO_MOVE }));
        returnedActions.push(setNextMoveText({ text: selectPawnMessage(opponentName) }));
      }
    } else {
      returnedActions.push(setNextMoveText({ text: putPawnMessage(opponentName) }));
      returnedActions.push(nextPlayer());
    }
  }

  if (currentAction === TAKE_ACTION &&
    selectedBox.pawn &&
    selectedBox.isHighlighted &&
    selectedBox.isInMill === 0
  ) {
    returnedActions.push(removePawnFromBoard({ row, column, player: opponent }));
    returnedActions.push(decreasePawnsFromBoard({ player: opponent }));
    if (opponentPawnsInHand === 0 && pawnsInHand === 0) {
      returnedActions.push(changeActionType({ type: SELECT_TO_MOVE }));
      returnedActions.push(setNextMoveText({ text: selectPawnMessage(opponentName) }));
    } else {
      returnedActions.push(setNextMoveText({ text: putPawnMessage(opponentName) }));
      returnedActions.push(changeActionType({ type: PUT_ACTION }));
    }
    returnedActions.push(cleanHighlightedPawns());
    returnedActions.push(nextPlayer());

    if (opponentPawnsInHand === 0 && pawnsInHand === 1 && currentAction !== TAKE_ACTION) {
      returnedActions.push(changeActionType({ type: moveOrJump(opponentPawnsOnBoard) }));
      returnedActions.push(setNextMoveText({ text: selectPawnMessage(opponentName) }));
    }
  }

  if ((currentAction === SELECT_TO_MOVE || currentAction === SELECT_TO_JUMP) && selectedBox.pawn === player) {
    let availableBoxes = { length: 1 };
    if (pawnsOnBoard === 3) {
      returnedActions.push(highlightAllAvailableBoxes());
    } else {
      availableBoxes = returnedActions = returnedActions.concat(findAvailableBoxes(board, selectedBox));
    }
    if (availableBoxes.length > 0) {
      returnedActions.push(cachePawnPosition({ row, column }));
      returnedActions.push(changeActionType({ type: MOVE_ACTION }));
      returnedActions.push(setNextMoveText({ text: movePawnMessage(playerName) }));
    }
  }

  if (currentAction === MOVE_ACTION && selectedBox.pawn === player) {
    returnedActions.push(cleanHighlightedPawns());
    if (pawnsOnBoard === 3) {
      returnedActions.push(highlightAllAvailableBoxes());
    } else {
      returnedActions = returnedActions.concat(findAvailableBoxes(board, selectedBox));
    }
    returnedActions.push(cachePawnPosition({ row, column }));
  }

  if (currentAction === MOVE_ACTION && selectedBox.isHighlighted) {
    returnedActions.push(removePawnFromBoard({ row: cachedPawn.row, column: cachedPawn.column, player }));
    returnedActions.push(setPawn({ row, column }));
    returnedActions.push(cleanHighlightedPawns());

    const cachedPawnBox: BoardCell = path([cachedPawn.column, cachedPawn.row], board);
    if (cachedPawnBox.isInMill > 0) {
      returnedActions.push(removeMillInBox({ row: cachedPawnBox.row, column: cachedPawnBox.column }));
      returnedActions = returnedActions.concat(removeMillOnTheBoard(board, cachedPawnBox));
    }

    const foundMill = findMillOnTheBoard(board, selectedBox, player, millSize, cachedPawn);
    returnedActions = returnedActions.concat(foundMill);

    if (foundMill.length) {
      returnedActions =
        returnedActions.concat(handleTakeMove(board, opponent, column, row, playerName, TAKE_AFTER_MOVE_ACTION));
    } else {
      returnedActions.push(setNextMoveText({ text: selectPawnMessage(opponentName) }));
      returnedActions.push(changeActionType({ type: moveOrJump(opponentPawnsOnBoard) }));
      returnedActions.push(nextPlayer());
    }
  }

  if (currentAction === TAKE_AFTER_MOVE_ACTION &&
    selectedBox.pawn &&
    selectedBox.isHighlighted &&
    selectedBox.isInMill === 0
  ) {
    returnedActions.push(removePawnFromBoard({ row, column, player: opponent }));
    returnedActions.push(decreasePawnsFromBoard({ player: opponent }));
    if (opponentPawnsOnBoard === 3) {
      returnedActions.push(setWinner({ player }));
      returnedActions.push(setNextMoveText({ text: setWinnerMessage(playerName) }));
      returnedActions.push(cleanHighlightedPawns());
      returnedActions.push(changeActionType({ type: END_GAME }));
    } else {
      returnedActions.push(setNextMoveText({ text: selectPawnMessage(opponentName) }));
      returnedActions.push(changeActionType({ type: moveOrJump(opponentPawnsOnBoard) }));
      returnedActions.push(cleanHighlightedPawns());
      returnedActions.push(nextPlayer());
    }
  }

  return returnedActions;
}
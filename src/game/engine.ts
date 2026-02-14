import { FallingObject, GameState, Lane, LevelConfig, Operation } from './types';

let idCounter = 0;

export function createInitialState(levelConfig: LevelConfig): GameState {
  idCounter = 0;
  return {
    score: 0,
    targetScore: levelConfig.targetScore,
    level: levelConfig.level,
    playerLane: 'left',
    objects: [],
    gameOver: false,
    levelComplete: false,
    isPaused: false,
    objectsCollected: 0,
    objectsMissed: 0,
  };
}

export function spawnObject(levelConfig: LevelConfig): FallingObject {
  const lane: Lane = Math.random() < 0.5 ? 'left' : 'right';
  const operation =
    levelConfig.availableOperations[
      Math.floor(Math.random() * levelConfig.availableOperations.length)
    ];

  return {
    id: `obj_${++idCounter}`,
    lane,
    operation,
    y: 0,
    announced: false,
    speed: levelConfig.objectSpeed,
  };
}

export function applyOperation(score: number, operation: Operation): number {
  switch (operation.type) {
    case '+':
      return score + operation.value;
    case '-':
      return score - operation.value;
    case '×':
      return score * operation.value;
    case '÷':
      return operation.value === 0
        ? score
        : Math.round(score / operation.value);
    default:
      return score;
  }
}

const PLAYER_Y = 0.85; // Player position (85% from top)
const COLLISION_THRESHOLD = 0.04; // How close object must be to player

export function tick(state: GameState): GameState {
  if (state.gameOver || state.levelComplete || state.isPaused) {
    return state;
  }

  let { score, objects, objectsCollected, objectsMissed } = state;
  let gameOver = false;
  let levelComplete = false;

  // Move objects down
  const updatedObjects: FallingObject[] = [];

  for (const obj of objects) {
    const newY = obj.y + obj.speed;

    // Check collision with player
    if (
      !obj.announced && // not already processed
      Math.abs(newY - PLAYER_Y) < COLLISION_THRESHOLD &&
      obj.lane === state.playerLane
    ) {
      // Player collects this object
      score = applyOperation(score, obj.operation);
      objectsCollected++;

      // Check win/lose
      if (score >= state.targetScore) {
        levelComplete = true;
      }
      if (score < -20) {
        gameOver = true;
      }

      // Don't add to updatedObjects (consumed)
      continue;
    }

    // Remove objects that passed the bottom
    if (newY > 1.1) {
      // Object passed without being collected
      if (obj.lane === state.playerLane) {
        // Should have been caught above, but just in case
      }
      objectsMissed++;
      continue;
    }

    updatedObjects.push({ ...obj, y: newY });
  }

  return {
    ...state,
    score,
    objects: updatedObjects,
    objectsCollected,
    objectsMissed,
    gameOver,
    levelComplete,
  };
}

export function movePlayer(state: GameState, lane: Lane): GameState {
  if (state.gameOver || state.levelComplete) return state;
  return { ...state, playerLane: lane };
}

export function addObject(
  state: GameState,
  obj: FallingObject
): GameState {
  return {
    ...state,
    objects: [...state.objects, obj],
  };
}

export { PLAYER_Y };

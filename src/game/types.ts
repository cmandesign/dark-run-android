export type OperationType = '+' | '-' | '×' | '÷';
export type Lane = 'left' | 'right';

export interface Operation {
  type: OperationType;
  value: number;
  display: string; // e.g. "+3", "-2", "×2", "÷2"
  speech: string; // e.g. "plus 3", "minus 2", "times 2", "divided by 2"
}

export interface OperationRange {
  type: OperationType;
  min: number;
  max: number;
}

export interface FallingObject {
  id: string;
  lane: Lane;
  operation: Operation;
  y: number; // 0 = top of screen, 1 = bottom (player position)
  announced: boolean;
  speed: number; // units per tick (fraction of screen height)
}

export interface GameState {
  score: number;
  targetScore: number;
  level: number;
  playerLane: Lane;
  objects: FallingObject[];
  gameOver: boolean;
  levelComplete: boolean;
  isPaused: boolean;
  objectsCollected: number;
  objectsMissed: number;
}

export interface LevelConfig {
  level: number;
  targetScore: number;
  description: string;
  speechDescription: string;
  operationRanges: OperationRange[];
  spawnIntervalMs: number; // time between spawns
  objectSpeed: number; // how fast objects fall
}

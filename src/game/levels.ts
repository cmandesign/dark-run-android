import { LevelConfig, Operation } from './types';

function op(type: '+' | '-' | '×' | '÷', value: number): Operation {
  const typeWords: Record<string, string> = {
    '+': 'plus',
    '-': 'minus',
    '×': 'times',
    '÷': 'divided by',
  };
  return {
    type,
    value,
    display: `${type}${value}`,
    speech: `${typeWords[type]} ${value}`,
  };
}

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    targetScore: 10,
    description: 'Reach 10',
    speechDescription: 'Reach a score of 10. Only addition!',
    availableOperations: [op('+', 1), op('+', 2), op('+', 3)],
    spawnIntervalMs: 2500,
    objectSpeed: 0.004,
  },
  {
    level: 2,
    targetScore: 15,
    description: 'Reach 15',
    speechDescription: 'Reach 15. Watch out for minus operations!',
    availableOperations: [
      op('+', 1),
      op('+', 2),
      op('+', 3),
      op('-', 1),
      op('-', 2),
    ],
    spawnIntervalMs: 2200,
    objectSpeed: 0.005,
  },
  {
    level: 3,
    targetScore: 20,
    description: 'Reach 20',
    speechDescription: 'Reach 20. Plus and minus, getting faster!',
    availableOperations: [
      op('+', 2),
      op('+', 3),
      op('+', 5),
      op('-', 1),
      op('-', 2),
      op('-', 3),
    ],
    spawnIntervalMs: 2000,
    objectSpeed: 0.006,
  },
  {
    level: 4,
    targetScore: 30,
    description: 'Reach 30',
    speechDescription: 'Reach 30. Multiply is here!',
    availableOperations: [
      op('+', 2),
      op('+', 3),
      op('+', 5),
      op('-', 2),
      op('-', 3),
      op('×', 2),
    ],
    spawnIntervalMs: 1800,
    objectSpeed: 0.006,
  },
  {
    level: 5,
    targetScore: 50,
    description: 'Reach 50',
    speechDescription: 'Reach 50. All operations available!',
    availableOperations: [
      op('+', 3),
      op('+', 5),
      op('+', 10),
      op('-', 2),
      op('-', 5),
      op('×', 2),
      op('×', 3),
      op('÷', 2),
    ],
    spawnIntervalMs: 1600,
    objectSpeed: 0.007,
  },
  {
    level: 6,
    targetScore: 100,
    description: 'Reach 100',
    speechDescription: 'Reach 100. Fast and furious!',
    availableOperations: [
      op('+', 5),
      op('+', 10),
      op('+', 15),
      op('-', 3),
      op('-', 5),
      op('-', 10),
      op('×', 2),
      op('×', 3),
      op('÷', 2),
    ],
    spawnIntervalMs: 1400,
    objectSpeed: 0.008,
  },
];

export function getLevelConfig(level: number): LevelConfig {
  if (level <= LEVELS.length) {
    return LEVELS[level - 1];
  }
  // For levels beyond defined ones, scale up difficulty
  const lastLevel = LEVELS[LEVELS.length - 1];
  const scaleFactor = level - LEVELS.length;
  return {
    ...lastLevel,
    level,
    targetScore: lastLevel.targetScore + scaleFactor * 50,
    description: `Reach ${lastLevel.targetScore + scaleFactor * 50}`,
    speechDescription: `Reach ${lastLevel.targetScore + scaleFactor * 50}. Extreme difficulty!`,
    spawnIntervalMs: Math.max(800, lastLevel.spawnIntervalMs - scaleFactor * 100),
    objectSpeed: Math.min(0.015, lastLevel.objectSpeed + scaleFactor * 0.001),
  };
}

import { LevelConfig } from './types';

export const LEVELS: LevelConfig[] = [
  {
    level: 1,
    targetScore: 20,
    description: 'Reach 20 — Addition only',
    speechDescription: 'Reach 20. Addition only, single digit numbers!',
    operationRanges: [{ type: '+', min: 1, max: 9 }],
    spawnIntervalMs: 2500,
    objectSpeed: 0.004,
  },
  {
    level: 2,
    targetScore: 30,
    description: 'Reach 30 — Plus & Minus',
    speechDescription: 'Reach 30. Watch out for minus!',
    operationRanges: [
      { type: '+', min: 1, max: 9 },
      { type: '-', min: 1, max: 5 },
    ],
    spawnIntervalMs: 2200,
    objectSpeed: 0.005,
  },
  {
    level: 3,
    targetScore: 50,
    description: 'Reach 50 — Bigger numbers',
    speechDescription: 'Reach 50. Numbers up to 15!',
    operationRanges: [
      { type: '+', min: 1, max: 15 },
      { type: '-', min: 1, max: 10 },
    ],
    spawnIntervalMs: 2000,
    objectSpeed: 0.006,
  },
  {
    level: 4,
    targetScore: 80,
    description: 'Reach 80 — Multiply joins',
    speechDescription: 'Reach 80. Multiply is here!',
    operationRanges: [
      { type: '+', min: 1, max: 20 },
      { type: '-', min: 1, max: 10 },
      { type: '×', min: 2, max: 5 },
    ],
    spawnIntervalMs: 1800,
    objectSpeed: 0.006,
  },
  {
    level: 5,
    targetScore: 150,
    description: 'Reach 150 — All operations',
    speechDescription: 'Reach 150. All operations!',
    operationRanges: [
      { type: '+', min: 1, max: 50 },
      { type: '-', min: 1, max: 20 },
      { type: '×', min: 2, max: 10 },
      { type: '÷', min: 2, max: 5 },
    ],
    spawnIntervalMs: 1600,
    objectSpeed: 0.007,
  },
  {
    level: 6,
    targetScore: 300,
    description: 'Reach 300 — Numbers to 99',
    speechDescription: 'Reach 300. Numbers up to 99. Fast and furious!',
    operationRanges: [
      { type: '+', min: 1, max: 99 },
      { type: '-', min: 1, max: 50 },
      { type: '×', min: 2, max: 10 },
      { type: '÷', min: 2, max: 5 },
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
    targetScore: lastLevel.targetScore + scaleFactor * 100,
    description: `Reach ${lastLevel.targetScore + scaleFactor * 100}`,
    speechDescription: `Reach ${lastLevel.targetScore + scaleFactor * 100}. Extreme difficulty!`,
    spawnIntervalMs: Math.max(800, lastLevel.spawnIntervalMs - scaleFactor * 100),
    objectSpeed: Math.min(0.015, lastLevel.objectSpeed + scaleFactor * 0.001),
  };
}

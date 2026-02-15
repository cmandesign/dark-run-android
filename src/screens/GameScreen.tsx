import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  AccessibilityInfo,
  Platform,
} from 'react-native';
import {
  GameState,
  FallingObject,
  Lane,
} from '../game/types';
import {
  createInitialState,
  spawnObject,
  tick,
  movePlayer,
  addObject,
  PLAYER_Y,
} from '../game/engine';
import { getLevelConfig } from '../game/levels';
import { stereoAudio } from '../audio/StereoAudio';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const LANE_WIDTH = SCREEN_WIDTH / 2;
const OBJECT_SIZE = 70;
const PLAYER_SIZE = 50;
const TICK_MS = 16; // ~60fps

// Colors for operation types
const OP_COLORS: Record<string, string> = {
  '+': '#4ade80', // green
  '-': '#f87171', // red
  '×': '#60a5fa', // blue
  '÷': '#fbbf24', // amber
};

interface GameScreenProps {
  level: number;
  onBack: () => void;
  onNextLevel: (level: number) => void;
}

export default function GameScreen({
  level,
  onBack,
  onNextLevel,
}: GameScreenProps) {
  const levelConfig = getLevelConfig(level);
  const [gameState, setGameState] = useState<GameState>(() =>
    createInitialState(levelConfig)
  );
  const gameStateRef = useRef(gameState);
  const lastSpawnTime = useRef(0);
  const gameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioInitialized = useRef(false);
  const [countdown, setCountdown] = useState(-1); // -1 = waiting for intro speech

  // Initialize audio and announce level, then start countdown
  useEffect(() => {
    let cancelled = false;

    const start = async () => {
      if (!audioInitialized.current) {
        await stereoAudio.init();
        audioInitialized.current = true;
      }

      // Wait for level intro to finish before starting countdown
      await stereoAudio.speakAndWait(
        `Level ${level}. ${levelConfig.speechDescription}. Get ready!`,
        { type: 'level_intro', level }
      );
      if (cancelled) return;
      setCountdown(3);
    };

    start();

    return () => {
      cancelled = true;
      stereoAudio.stop();
      if (gameLoopRef.current) {
        clearInterval(gameLoopRef.current);
      }
    };
  }, []);

  // Countdown before game starts — speak immediately, then decrement after 1s
  useEffect(() => {
    if (countdown < 0) return;
    if (countdown === 0) {
      stereoAudio.speak('Go!', { type: 'countdown', value: 'go' });
      return;
    }

    stereoAudio.speak(`${countdown}`, { type: 'countdown', value: countdown });

    const timer = setTimeout(() => {
      setCountdown((c) => c - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [countdown]);

  // Start game loop after countdown
  useEffect(() => {
    if (countdown !== 0) return;

    lastSpawnTime.current = Date.now();

    const loop = setInterval(() => {
      const now = Date.now();
      const state = gameStateRef.current;

      if (state.gameOver || state.levelComplete || state.isPaused) return;

      // Check if we need to spawn
      let newState = state;
      if (now - lastSpawnTime.current >= levelConfig.spawnIntervalMs) {
        const obj = spawnObject(levelConfig);
        newState = addObject(newState, obj);
        lastSpawnTime.current = now;

        // Announce the new object (composed audio: "plus" "three")
        stereoAudio.announceObject(
          obj.lane,
          obj.operation.type,
          obj.operation.value,
          obj.operation.speech
        );
      }

      // Tick the game
      const prevScore = newState.score;
      const updated = tick(newState);

      // Play stereo collect chirp on score change
      if (updated.score !== prevScore) {
        stereoAudio.playCollect(state.playerLane);
      }

      // Handle level complete — stop pending announcements first
      if (updated.levelComplete && !state.levelComplete) {
        gameStateRef.current = updated;
        stereoAudio.stop();
        stereoAudio.playSuccess();
        stereoAudio.announceLevelComplete(level, updated.score);
      }

      // Handle game over — stop pending announcements first
      if (updated.gameOver && !state.gameOver) {
        gameStateRef.current = updated;
        stereoAudio.stop();
        stereoAudio.playGameOver();
        stereoAudio.announceGameOver(updated.score);
      }

      gameStateRef.current = updated;
      setGameState(updated);
    }, TICK_MS);

    gameLoopRef.current = loop;

    return () => clearInterval(loop);
  }, [countdown]);

  // Handle lane switch — must also update ref so game loop sees the change
  const switchLane = useCallback((lane: Lane) => {
    setGameState((prev) => {
      const next = movePlayer(prev, lane);
      gameStateRef.current = next;
      return next;
    });
  }, []);

  // Pan responder for swipe and tap gestures
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderRelease: (evt, gestureState) => {
        if (Math.abs(gestureState.dx) > 30) {
          // Swipe: use direction
          switchLane(gestureState.dx > 0 ? 'right' : 'left');
        } else {
          // Tap: use touch position
          const touchX = evt.nativeEvent.pageX;
          switchLane(touchX < SCREEN_WIDTH / 2 ? 'left' : 'right');
        }
      },
    })
  ).current;

  // Keyboard support for web
  useEffect(() => {
    if (Platform.OS !== 'web') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        switchLane('left');
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        switchLane('right');
      }
    };

    // @ts-ignore - addEventListener on document for web
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      // @ts-ignore
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [switchLane]);

  // Render countdown overlay (also shown during intro speech when countdown is -1)
  if (countdown !== 0) {
    return (
      <View style={styles.container}>
        <View style={styles.countdownOverlay}>
          <Text style={styles.levelTitle}>Level {level}</Text>
          <Text style={styles.levelDesc}>{levelConfig.description}</Text>
          <Text style={styles.countdownText}>
            {countdown > 0 ? countdown : ''}
          </Text>
        </View>
      </View>
    );
  }

  // Render game over overlay
  if (gameState.gameOver) {
    return (
      <View style={styles.container}>
        <View style={styles.overlayCenter}>
          <Text
            style={styles.gameOverText}
            accessibilityRole="header"
            accessibilityLabel={`Game over. Your score was ${gameState.score}`}
          >
            GAME OVER
          </Text>
          <Text style={styles.overlayScore}>Score: {gameState.score}</Text>
          <Text style={styles.overlayStats}>
            Collected: {gameState.objectsCollected} | Missed:{' '}
            {gameState.objectsMissed}
          </Text>
          <TouchableOpacity
            style={styles.overlayButton}
            onPress={() => {
              stereoAudio.stop();
              setGameState(createInitialState(levelConfig));
              setCountdown(3);
            }}
            accessibilityLabel="Try again"
            accessibilityRole="button"
          >
            <Text style={styles.overlayButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.overlayButton, styles.secondaryButton]}
            onPress={() => {
              stereoAudio.stop();
              onBack();
            }}
            accessibilityLabel="Back to menu"
            accessibilityRole="button"
          >
            <Text style={styles.overlayButtonText}>Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Render level complete overlay
  if (gameState.levelComplete) {
    return (
      <View style={styles.container}>
        <View style={styles.overlayCenter}>
          <Text
            style={styles.successText}
            accessibilityRole="header"
            accessibilityLabel={`Level ${level} complete! Score: ${gameState.score}`}
          >
            LEVEL COMPLETE!
          </Text>
          <Text style={styles.overlayScore}>Score: {gameState.score}</Text>
          <Text style={styles.overlayStats}>
            Collected: {gameState.objectsCollected} | Missed:{' '}
            {gameState.objectsMissed}
          </Text>
          <TouchableOpacity
            style={styles.overlayButton}
            onPress={() => {
              stereoAudio.stop();
              onNextLevel(level + 1);
            }}
            accessibilityLabel="Next level"
            accessibilityRole="button"
          >
            <Text style={styles.overlayButtonText}>Next Level</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.overlayButton, styles.secondaryButton]}
            onPress={() => {
              stereoAudio.stop();
              onBack();
            }}
            accessibilityLabel="Back to menu"
            accessibilityRole="button"
          >
            <Text style={styles.overlayButtonText}>Menu</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main game render
  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      {/* HUD */}
      <View style={styles.hud} accessibilityRole="summary">
        <TouchableOpacity
          onPress={() => {
            stereoAudio.stop();
            onBack();
          }}
          style={styles.backButton}
          accessibilityLabel="Back to menu"
          accessibilityRole="button"
        >
          <Text style={styles.backButtonText}>{'◀ Menu'}</Text>
        </TouchableOpacity>
        <View style={styles.hudCenter}>
          <Text
            style={styles.scoreText}
            accessibilityLabel={`Score: ${gameState.score}`}
            accessibilityLiveRegion="polite"
          >
            Score: {gameState.score}
          </Text>
          <Text style={styles.targetText}>
            Target: {gameState.targetScore}
          </Text>
        </View>
        <Text style={styles.levelText}>Lv.{level}</Text>
      </View>

      {/* Game board */}
      <View style={styles.board}>
        {/* Lane divider */}
        <View style={styles.laneDivider} />

        {/* Lane labels */}
        <View style={styles.laneLabels}>
          <Text style={styles.laneLabel}>LEFT</Text>
          <Text style={styles.laneLabel}>RIGHT</Text>
        </View>

        {/* Falling objects */}
        {gameState.objects.map((obj) => (
          <FallingObjectView key={obj.id} obj={obj} />
        ))}

        {/* Player */}
        <View
          style={[
            styles.player,
            {
              left:
                gameState.playerLane === 'left'
                  ? LANE_WIDTH / 2 - PLAYER_SIZE / 2
                  : LANE_WIDTH + LANE_WIDTH / 2 - PLAYER_SIZE / 2,
              top: PLAYER_Y * SCREEN_HEIGHT - 80 - PLAYER_SIZE / 2,
            },
          ]}
          accessibilityLabel={`Player in ${gameState.playerLane} lane`}
        >
          <Text style={styles.playerIcon}>▲</Text>
        </View>

        {/* Lane tap hints */}
        <View style={styles.tapHints}>
          <TouchableOpacity
            style={styles.tapZone}
            onPress={() => switchLane('left')}
            accessibilityLabel="Move to left lane"
            accessibilityRole="button"
          >
            <Text style={styles.tapHintText}>◀</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.tapZone}
            onPress={() => switchLane('right')}
            accessibilityLabel="Move to right lane"
            accessibilityRole="button"
          >
            <Text style={styles.tapHintText}>▶</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Score bar */}
      <View style={styles.scoreBar}>
        <View
          style={[
            styles.scoreBarFill,
            {
              width: `${Math.max(
                0,
                Math.min(100, (gameState.score / gameState.targetScore) * 100)
              )}%`,
              backgroundColor:
                gameState.score < 0 ? '#f87171' : '#4ade80',
            },
          ]}
        />
      </View>
    </View>
  );
}

// Individual falling object component
function FallingObjectView({ obj }: { obj: FallingObject }) {
  const color = OP_COLORS[obj.operation.type] || '#ffffff';
  const left =
    obj.lane === 'left'
      ? LANE_WIDTH / 2 - OBJECT_SIZE / 2
      : LANE_WIDTH + LANE_WIDTH / 2 - OBJECT_SIZE / 2;
  const top = obj.y * (SCREEN_HEIGHT - 80) - OBJECT_SIZE / 2;

  return (
    <View
      style={[
        styles.fallingObject,
        {
          left,
          top,
          borderColor: color,
          backgroundColor: color + '20',
        },
      ]}
      accessibilityLabel={`${obj.operation.speech} in ${obj.lane} lane`}
    >
      <Text style={[styles.objectText, { color }]}>
        {obj.operation.display}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  // Countdown
  countdownOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  levelTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#e94560',
    marginBottom: 8,
  },
  levelDesc: {
    fontSize: 18,
    color: '#e0e0f0',
    marginBottom: 40,
  },
  countdownText: {
    fontSize: 96,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  // Overlays
  overlayCenter: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  gameOverText: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#f87171',
    marginBottom: 16,
  },
  successText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#4ade80',
    marginBottom: 16,
    textAlign: 'center',
  },
  overlayScore: {
    fontSize: 24,
    color: '#e0e0f0',
    marginBottom: 8,
  },
  overlayStats: {
    fontSize: 16,
    color: '#8888a0',
    marginBottom: 32,
  },
  overlayButton: {
    backgroundColor: '#e94560',
    paddingHorizontal: 40,
    paddingVertical: 14,
    borderRadius: 12,
    marginBottom: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  overlayButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#ffffff',
  },
  // HUD
  hud: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: '#16213e',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#e94560',
    fontSize: 14,
    fontWeight: '600',
  },
  hudCenter: {
    alignItems: 'center',
  },
  scoreText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  targetText: {
    fontSize: 12,
    color: '#53a8b6',
  },
  levelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e94560',
  },
  // Board
  board: {
    flex: 1,
    position: 'relative',
    overflow: 'hidden',
  },
  laneDivider: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: SCREEN_WIDTH / 2 - 1,
    width: 2,
    backgroundColor: '#0f3460',
  },
  laneLabels: {
    flexDirection: 'row',
    position: 'absolute',
    top: 8,
    left: 0,
    right: 0,
  },
  laneLabel: {
    flex: 1,
    textAlign: 'center',
    color: '#333355',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
  },
  // Falling objects
  fallingObject: {
    position: 'absolute',
    width: OBJECT_SIZE,
    height: OBJECT_SIZE,
    borderRadius: OBJECT_SIZE / 2,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  objectText: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  // Player
  player: {
    position: 'absolute',
    width: PLAYER_SIZE,
    height: PLAYER_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerIcon: {
    fontSize: 40,
    color: '#ffffff',
  },
  // Tap hints
  tapHints: {
    position: 'absolute',
    bottom: 20,
    left: 0,
    right: 0,
    flexDirection: 'row',
  },
  tapZone: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  tapHintText: {
    fontSize: 24,
    color: '#333355',
  },
  // Score bar
  scoreBar: {
    height: 6,
    backgroundColor: '#0f3460',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
});

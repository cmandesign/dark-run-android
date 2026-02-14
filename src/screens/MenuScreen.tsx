import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  AccessibilityInfo,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LEVELS } from '../game/levels';

interface MenuScreenProps {
  onStartGame: (level: number) => void;
}

export default function MenuScreen({ onStartGame }: MenuScreenProps) {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          DARK RUN
        </Text>
        <Text style={styles.subtitle}>A Math Survival Game</Text>
        <Text style={styles.description}>
          Swipe left or right to collect math operations.{'\n'}
          Reach the target score to complete each level!{'\n'}
          Audio announces objects in stereo for accessibility.
        </Text>
      </View>

      <View style={styles.levelList}>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          Select Level
        </Text>

        {LEVELS.map((level) => (
          <TouchableOpacity
            key={level.level}
            style={styles.levelButton}
            onPress={() => onStartGame(level.level)}
            accessibilityLabel={`Level ${level.level}: ${level.speechDescription}`}
            accessibilityRole="button"
            accessibilityHint="Double tap to start this level"
          >
            <View style={styles.levelButtonContent}>
              <Text style={styles.levelNumber}>Level {level.level}</Text>
              <Text style={styles.levelDescription}>{level.description}</Text>
              <Text style={styles.levelTarget}>
                Target: {level.targetScore}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionTitle}>How to Play:</Text>
        <Text style={styles.instructionText}>
          • Objects fall from the top in two lanes{'\n'}
          • Swipe LEFT or RIGHT to switch lanes{'\n'}
          • Collect objects to apply math to your score{'\n'}
          • Reach the target score to win!{'\n'}
          • Score below -20 = Game Over{'\n'}
          • Wear headphones for stereo audio cues
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 42,
    fontWeight: 'bold',
    color: '#e94560',
    letterSpacing: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#a0a0b0',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#8888a0',
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#e0e0f0',
    marginBottom: 12,
  },
  levelList: {
    flex: 1,
  },
  levelButton: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  levelButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  levelNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#e94560',
    width: 80,
  },
  levelDescription: {
    fontSize: 16,
    color: '#e0e0f0',
    flex: 1,
  },
  levelTarget: {
    fontSize: 14,
    color: '#53a8b6',
  },
  instructions: {
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#0f3460',
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e0e0f0',
    marginBottom: 8,
  },
  instructionText: {
    fontSize: 13,
    color: '#8888a0',
    lineHeight: 20,
  },
});

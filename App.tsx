import React, { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MenuScreen from './src/screens/MenuScreen';
import GameScreen from './src/screens/GameScreen';

type Screen =
  | { type: 'menu' }
  | { type: 'game'; level: number };

export default function App() {
  const [screen, setScreen] = useState<Screen>({ type: 'menu' });

  switch (screen.type) {
    case 'menu':
      return (
        <SafeAreaProvider>
          <MenuScreen onStartGame={(level) => setScreen({ type: 'game', level })} />
        </SafeAreaProvider>
      );
    case 'game':
      return (
        <SafeAreaProvider>
          <GameScreen
            key={`game-${screen.level}-${Date.now()}`}
            level={screen.level}
            onBack={() => setScreen({ type: 'menu' })}
            onNextLevel={(nextLevel) =>
              setScreen({ type: 'game', level: nextLevel })
            }
          />
        </SafeAreaProvider>
      );
  }
}

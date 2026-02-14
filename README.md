# Dark Run - Accessible Math Survival Game

A simple, accessible math game built with React Native (Expo) for Android and Web.

Objects with math operations (+3, -2, ×2, ÷2) fall from the top of the screen in two lanes. Swipe left or right to collect them and reach the target score!

**Designed for accessibility**: All incoming objects are announced via stereo audio — objects in the left lane play in your left headphone, objects in the right lane play in your right headphone. Wear headphones for the best experience!

## How to Play

- **Two lanes**: Objects fall in the left or right lane
- **Swipe left/right** (or tap the left/right side of the screen) to switch lanes
- **On web**: Use arrow keys or A/D keys
- **Collect objects** by being in the same lane when they reach you
- **Reach the target score** to complete the level
- **Don't go below -20** or it's game over!

## Audio Accessibility

- Stereo directional beep indicates which lane an object is in
- Text-to-speech announces the math operation (e.g., "plus 3", "times 2")
- Score changes are announced audibly
- Level start and completion use speech announcements

## Setup

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# Run on web
npx expo start --web

# Run on Android (requires Android device/emulator)
npx expo start --android
```

## Build

### Web

```bash
npx expo export --platform web
```

Output will be in the `dist/` directory. Serve with any static file server.

### Android APK

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Build APK (preview profile)
eas build --platform android --profile preview
```

## Project Structure

```
├── App.tsx                      # Entry point, screen navigation
├── src/
│   ├── screens/
│   │   ├── MenuScreen.tsx       # Level selection menu
│   │   └── GameScreen.tsx       # Main game with rendering & gestures
│   ├── game/
│   │   ├── types.ts             # TypeScript type definitions
│   │   ├── engine.ts            # Game logic (spawn, tick, collision)
│   │   └── levels.ts            # Level configurations
│   └── audio/
│       └── StereoAudio.ts       # Stereo audio manager (Web Audio API + WAV gen)
├── app.json                     # Expo configuration
├── eas.json                     # EAS Build profiles
└── package.json
```

## CI/CD Pipeline

### Continuous Integration (`.github/workflows/ci.yml`)

Runs on every push and pull request:
- TypeScript type checking
- Web build verification

### Release Pipeline (`.github/workflows/release.yml`)

Creates a GitHub Release with both Web and Android builds. Two ways to trigger:

**Option 1: Tag push**
```bash
git tag v1.0.0
git push origin v1.0.0
```

**Option 2: Manual dispatch**
1. Go to Actions tab in GitHub
2. Select "Release" workflow
3. Click "Run workflow"
4. Enter a version number (e.g. `1.0.0`)

The release will automatically:
1. Type-check the project
2. Build the web version and package as `dark-run-web.zip`
3. Build the Android APK using Expo prebuild + Gradle
4. Create a GitHub Release with both artifacts attached

### Release Signing (Android)

By default, the APK is signed with a debug key. For production releases, add a signing config:

1. Generate a keystore: `keytool -genkey -v -keystore dark-run.jks -keyalg RSA -keysize 2048 -validity 10000 -alias dark-run`
2. Add these GitHub repository secrets:
   - `KEYSTORE_BASE64` — base64-encoded keystore file
   - `KEYSTORE_PASSWORD`
   - `KEY_ALIAS`
   - `KEY_PASSWORD`
3. Update the release workflow's Android build step to use the signing config

## Tech Stack

- **React Native** via Expo SDK 52
- **expo-av** for audio playback on native
- **expo-speech** for text-to-speech
- **Web Audio API** for stereo panning on web
- **Programmatic WAV generation** for stereo panning on Android

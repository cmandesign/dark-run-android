import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { File as FSFile, Paths } from 'expo-file-system';
import { Lane } from '../game/types';

/**
 * Generates a stereo WAV file as a Uint8Array.
 * The tone is panned to the specified channel (left/right/center).
 */
function generateStereoWav(
  frequency: number,
  durationMs: number,
  pan: Lane | 'center',
  sampleRate: number = 44100
): Uint8Array {
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const numChannels = 2;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * blockAlign;
  const fileSize = 44 + dataSize;

  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  // RIFF header
  writeStr(0, 'RIFF');
  view.setUint32(4, fileSize - 8, true);
  writeStr(8, 'WAVE');

  // fmt chunk
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // data chunk
  writeStr(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate stereo samples
  const fadeMs = 10;
  const fadeSamples = Math.floor((sampleRate * fadeMs) / 1000);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const rawSample = Math.sin(2 * Math.PI * frequency * t);

    let envelope = 1;
    if (i < fadeSamples) {
      envelope = i / fadeSamples;
    } else if (i > numSamples - fadeSamples) {
      envelope = (numSamples - i) / fadeSamples;
    }

    const sample = rawSample * envelope * 0.6;

    let leftSample: number;
    let rightSample: number;
    if (pan === 'left') {
      leftSample = sample;
      rightSample = sample * 0.1;
    } else if (pan === 'right') {
      leftSample = sample * 0.1;
      rightSample = sample;
    } else {
      leftSample = sample;
      rightSample = sample;
    }

    const offset = 44 + i * blockAlign;
    view.setInt16(offset, Math.floor(leftSample * 32767), true);
    view.setInt16(offset + 2, Math.floor(rightSample * 32767), true);
  }

  return new Uint8Array(buffer);
}

// Frequency mapping for operation types
const OPERATION_FREQUENCIES: Record<string, number> = {
  '+': 523, // C5 - bright, positive
  '-': 330, // E4 - lower, cautious
  '×': 659, // E5 - high, exciting
  '÷': 392, // G4 - medium
};

class StereoAudioManager {
  private webAudioContext: AudioContext | null = null;
  private initialized = false;
  private soundCache: Map<string, Audio.Sound> = new Map();
  private fileCache: Map<string, string> = new Map(); // cacheKey -> file path
  private audioEnabled = true;
  private speechEnabled = true;

  async init(): Promise<void> {
    if (this.initialized) return;

    try {
      if (Platform.OS === 'web') {
        // @ts-ignore - AudioContext may not be typed
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.webAudioContext = new AudioCtx();
        }
      }

      // Configure audio for mobile
      if (Platform.OS !== 'web') {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
      }

      this.initialized = true;
    } catch (e) {
      console.warn('Audio init failed:', e);
    }
  }

  setAudioEnabled(enabled: boolean) {
    this.audioEnabled = enabled;
  }

  setSpeechEnabled(enabled: boolean) {
    this.speechEnabled = enabled;
  }

  /**
   * Stop any pending speech immediately.
   */
  stopSpeech(): void {
    try {
      Speech.stop();
    } catch (_) {
      // ignore
    }
  }

  /**
   * Play a directional beep tone panned to the specified lane.
   */
  async playDirectionalTone(
    lane: Lane,
    operationType: string,
    durationMs: number = 200
  ): Promise<void> {
    if (!this.audioEnabled) return;

    const frequency = OPERATION_FREQUENCIES[operationType] || 440;

    if (Platform.OS === 'web') {
      this.playWebTone(lane, frequency, durationMs);
    } else {
      await this.playNativeTone(lane, frequency, durationMs);
    }
  }

  private playWebTone(lane: Lane, frequency: number, durationMs: number) {
    if (!this.webAudioContext) return;

    if (this.webAudioContext.state === 'suspended') {
      this.webAudioContext.resume();
    }

    const ctx = this.webAudioContext;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    const panner = ctx.createStereoPanner();

    oscillator.type = 'sine';
    oscillator.frequency.value = frequency;
    gainNode.gain.value = 0.4;
    panner.pan.value = lane === 'left' ? -1 : 1;

    const now = ctx.currentTime;
    const endTime = now + durationMs / 1000;
    gainNode.gain.setValueAtTime(0.4, now);
    gainNode.gain.exponentialRampToValueAtTime(0.01, endTime);

    oscillator.connect(gainNode);
    gainNode.connect(panner);
    panner.connect(ctx.destination);

    oscillator.start(now);
    oscillator.stop(endTime);
  }

  /**
   * Write a WAV to a temp file and play it.
   * Data URIs don't work reliably with expo-av on Android.
   */
  private async playNativeTone(
    lane: Lane,
    frequency: number,
    durationMs: number
  ): Promise<void> {
    try {
      const cacheKey = `${lane}_${frequency}_${durationMs}`;

      // Check if we already have a cached Sound object
      let sound = this.soundCache.get(cacheKey);
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
        return;
      }

      // Generate WAV and write to temp file
      let fileUri = this.fileCache.get(cacheKey);
      if (!fileUri) {
        const wavBytes = generateStereoWav(frequency, durationMs, lane);
        const file = new FSFile(Paths.cache, `tone_${cacheKey}.wav`);
        if (file.exists) {
          file.delete();
        }
        file.create();
        file.write(wavBytes);
        fileUri = file.uri;
        this.fileCache.set(cacheKey, fileUri);
      }

      const result = await Audio.Sound.createAsync({ uri: fileUri });
      sound = result.sound;
      this.soundCache.set(cacheKey, sound);
      await sound.playAsync();
    } catch (e) {
      console.warn('Native tone playback failed:', e);
    }
  }

  /**
   * Speak text using text-to-speech.
   * Stops any pending speech first to avoid queue buildup.
   */
  speak(text: string): void {
    if (!this.speechEnabled) return;

    try {
      Speech.stop();
      Speech.speak(text, {
        rate: 1.3,
        pitch: 1.0,
        language: 'en-US',
      });
    } catch (e) {
      console.warn('Speech failed:', e);
    }
  }

  /**
   * Speak text, returning a promise that resolves when speech finishes.
   */
  speakAndWait(text: string): Promise<void> {
    if (!this.speechEnabled) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        Speech.stop();
        Speech.speak(text, {
          rate: 1.3,
          pitch: 1.0,
          language: 'en-US',
          onDone: () => resolve(),
          onError: () => resolve(),
          onStopped: () => resolve(),
        });
      } catch (e) {
        console.warn('Speech failed:', e);
        resolve();
      }
    });
  }

  /**
   * Announce a falling object: directional tone + speech with lane context.
   */
  async announceObject(
    lane: Lane,
    operationType: string,
    speechText: string
  ): Promise<void> {
    await this.playDirectionalTone(lane, operationType);

    // Include lane in speech so user knows direction even though TTS is not panned
    setTimeout(() => {
      this.speak(`${lane}, ${speechText}`);
    }, 250);
  }

  /**
   * Play a celebration sound (centered, pleasant chord).
   */
  async playSuccess(): Promise<void> {
    if (!this.audioEnabled) return;

    if (Platform.OS === 'web' && this.webAudioContext) {
      const ctx = this.webAudioContext;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.3, now + i * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.01, now + i * 0.1 + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + i * 0.1);
        osc.stop(now + i * 0.1 + 0.5);
      });
    } else {
      await this.playNativeTone('left', 784, 300); // reuse with center-ish tone
    }
  }

  /**
   * Play a game over sound.
   */
  async playGameOver(): Promise<void> {
    if (!this.audioEnabled) return;

    if (Platform.OS === 'web' && this.webAudioContext) {
      const ctx = this.webAudioContext;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(100, now + 0.8);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.8);
    } else {
      // Play a low centered tone for game over
      try {
        const cacheKey = 'gameover_center';
        let sound = this.soundCache.get(cacheKey);
        if (sound) {
          await sound.setPositionAsync(0);
          await sound.playAsync();
          return;
        }
        let fileUri = this.fileCache.get(cacheKey);
        if (!fileUri) {
          const wavBytes = generateStereoWav(200, 500, 'center');
          const file = new FSFile(Paths.cache, `tone_${cacheKey}.wav`);
          if (file.exists) {
            file.delete();
          }
          file.create();
          file.write(wavBytes);
          fileUri = file.uri;
          this.fileCache.set(cacheKey, fileUri);
        }
        const { sound: s } = await Audio.Sound.createAsync({ uri: fileUri });
        this.soundCache.set(cacheKey, s);
        await s.playAsync();
      } catch (e) {
        console.warn('Game over sound failed:', e);
      }
    }
  }

  /**
   * Play a collect sound when player picks up an object.
   */
  async playCollect(lane: Lane): Promise<void> {
    if (!this.audioEnabled) return;

    if (Platform.OS === 'web' && this.webAudioContext) {
      const ctx = this.webAudioContext;
      if (ctx.state === 'suspended') await ctx.resume();

      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const panner = ctx.createStereoPanner();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      panner.pan.value = lane === 'left' ? -0.7 : 0.7;
      osc.connect(gain);
      gain.connect(panner);
      panner.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.15);
    } else {
      await this.playNativeTone(lane, 880, 150);
    }
  }

  /**
   * Announce score change via speech.
   */
  announceScore(score: number): void {
    this.speak(`Score: ${score}`);
  }

  /**
   * Clean up audio resources.
   */
  async cleanup(): Promise<void> {
    for (const sound of this.soundCache.values()) {
      try {
        await sound.unloadAsync();
      } catch (e) {
        // ignore
      }
    }
    this.soundCache.clear();
    this.fileCache.clear();

    if (this.webAudioContext) {
      try {
        await this.webAudioContext.close();
      } catch (e) {
        // ignore
      }
      this.webAudioContext = null;
    }

    this.initialized = false;
  }
}

// Singleton instance
export const stereoAudio = new StereoAudioManager();

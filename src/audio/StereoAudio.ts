import { Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import * as FileSystem from 'expo-file-system';
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

/**
 * Convert Uint8Array to base64 string.
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa !== 'undefined'
    ? btoa(binary)
    : Buffer.from(binary, 'binary').toString('base64');
}

/**
 * Single-threaded audio manager.
 *
 * All speech goes through one queue so announcements never overlap,
 * loop, or fight with each other. Stereo WAV tones (collect sounds)
 * play independently since they don't use the TTS engine.
 */
class StereoAudioManager {
  private webAudioContext: AudioContext | null = null;
  private initialized = false;
  private soundCache: Map<string, Audio.Sound> = new Map();
  private fileCache: Map<string, string> = new Map();
  private audioEnabled = true;
  private speechEnabled = true;

  // --- Single announcement queue ---
  private speaking = false;
  private stopped = false;

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

  // ─── Speech: single owner ───

  /**
   * Interrupt any current speech and speak new text immediately.
   * This is the ONLY way speech is triggered — no scattered Speech.speak calls.
   */
  speak(text: string): void {
    if (!this.speechEnabled) return;

    try {
      this.stopped = false;
      Speech.stop();
      Speech.speak(text, {
        rate: 1.3,
        pitch: 1.0,
        language: 'en-US',
        onDone: () => {
          this.speaking = false;
        },
        onError: () => {
          this.speaking = false;
        },
        onStopped: () => {
          this.speaking = false;
        },
      });
      this.speaking = true;
    } catch (e) {
      console.warn('Speech failed:', e);
      this.speaking = false;
    }
  }

  /**
   * Speak text and wait for it to finish before resolving.
   */
  speakAndWait(text: string): Promise<void> {
    if (!this.speechEnabled) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        this.stopped = false;
        Speech.stop();
        Speech.speak(text, {
          rate: 1.3,
          pitch: 1.0,
          language: 'en-US',
          onDone: () => {
            this.speaking = false;
            resolve();
          },
          onError: () => {
            this.speaking = false;
            resolve();
          },
          onStopped: () => {
            this.speaking = false;
            resolve();
          },
        });
        this.speaking = true;
      } catch (e) {
        console.warn('Speech failed:', e);
        this.speaking = false;
        resolve();
      }
    });
  }

  /**
   * Stop all speech and prevent queued callbacks from firing new speech.
   */
  stop(): void {
    this.stopped = true;
    this.speaking = false;
    try {
      Speech.stop();
    } catch (_) {
      // ignore
    }
  }

  /**
   * Announce a falling object with lane context.
   * Example: "left, plus 3"
   */
  announceObject(
    lane: Lane,
    _operationType: string,
    speechText: string
  ): void {
    if (this.stopped) return;
    this.speak(`${lane}, ${speechText}`);
  }

  /**
   * Announce level complete — stops any in-flight speech first.
   */
  announceLevelComplete(level: number, score: number): void {
    this.speak(`Level ${level} complete! Score: ${score}`);
  }

  /**
   * Announce game over — stops any in-flight speech first.
   */
  announceGameOver(score: number): void {
    this.speak(`Game over. Score: ${score}`);
  }

  // ─── Sound effects (stereo WAV, independent of TTS) ───

  /**
   * Play a stereo collect chirp panned to the lane where the object was picked up.
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
   * Play a celebration sound.
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
      await this.playNativeTone('left', 784, 300);
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
          const base64 = uint8ArrayToBase64(wavBytes);
          fileUri = `${FileSystem.cacheDirectory}tone_${cacheKey}.wav`;
          await FileSystem.writeAsStringAsync(fileUri, base64, {
            encoding: FileSystem.EncodingType.Base64,
          });
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

  // ─── Internal: native stereo tone via temp WAV file ───

  private async playNativeTone(
    lane: Lane,
    frequency: number,
    durationMs: number
  ): Promise<void> {
    try {
      const cacheKey = `${lane}_${frequency}_${durationMs}`;

      let sound = this.soundCache.get(cacheKey);
      if (sound) {
        await sound.setPositionAsync(0);
        await sound.playAsync();
        return;
      }

      let fileUri = this.fileCache.get(cacheKey);
      if (!fileUri) {
        const wavBytes = generateStereoWav(frequency, durationMs, lane);
        const base64 = uint8ArrayToBase64(wavBytes);
        fileUri = `${FileSystem.cacheDirectory}tone_${cacheKey}.wav`;
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
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
   * Clean up all audio resources.
   */
  async cleanup(): Promise<void> {
    this.stop();

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

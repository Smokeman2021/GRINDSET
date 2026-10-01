// Короткі ігрові звуки (синтезовані хвилі, без семплів). Вимикаються перемикачем «Звуки» в профілі.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useStore } from './store';

const SOURCES = {
  correct: require('../assets/sounds/correct.wav'),
  wrong: require('../assets/sounds/wrong.wav'),
  crown: require('../assets/sounds/crown.wav'),
  coin: require('../assets/sounds/coin.wav'),
  levelup: require('../assets/sounds/levelup.wav'),
  tap: require('../assets/sounds/tap.wav'),
  streak: require('../assets/sounds/streak.wav'),
} as const;

export type SfxName = keyof typeof SOURCES;

const players: Partial<Record<SfxName, AudioPlayer>> = {};
let audioReady = false;

function ensure(name: SfxName): AudioPlayer {
  if (!players[name]) players[name] = createAudioPlayer(SOURCES[name]);
  return players[name]!;
}

// Викликати один раз при старті застосунку (дозволяє звук навіть у режимі «беззвучний дзвінок» на iOS)
export async function initAudio() {
  if (audioReady) return;
  audioReady = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // веб і деякі емулятори можуть не підтримувати — це не критично
  }
}

export function playSfx(name: SfxName) {
  if (!useStore.getState().soundEnabled) return;
  try {
    const p = ensure(name);
    p.seekTo(0);
    p.play();
  } catch {
    // тихо ігноруємо збій відтворення — звук ніколи не повинен ламати урок
  }
}

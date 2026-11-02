// Пози Гріндіка. pose(name) повертає НОВИЙ живописний арт (art-v2): це повні картини на тлі, не вирізки, тому framed = true
// і показуються вони в рамці-картині (див. components/PoseImage). poseCutout(name) лишає старі вирізані 3D-пози з прозорістю:
// вони потрібні там, де фігура стоїть просто на фоні екрана (шлях уроків); коли прийдуть вирізки в новому стилі, їх можна
// підмінити тут, не чіпаючи компонентів. ratio = ширина/висота файлу.
import { art, type ArtKey } from '../art';

const CUTOUTS = {
  stand: { src: require('../../assets/character/pose-stand.png'), ratio: 0.374 },
  think: { src: require('../../assets/character/pose-think.png'), ratio: 0.405 },
  cheer: { src: require('../../assets/character/pose-cheer.png'), ratio: 0.549 },
  laptop: { src: require('../../assets/character/pose-laptop.png'), ratio: 0.542 },
  rest: { src: require('../../assets/character/pose-rest.png'), ratio: 0.74 },
  phone: { src: require('../../assets/character/pose-phone.png'), ratio: 0.469 },
  coin: { src: require('../../assets/character/pose-coin.png'), ratio: 0.466 },
  wave: { src: require('../../assets/character/pose-wave.png'), ratio: 0.477 },
  crown: { src: require('../../assets/character/pose-crown.png'), ratio: 0.452 },
  point: { src: require('../../assets/character/pose-point.png'), ratio: 0.493 },
  shrug: { src: require('../../assets/character/pose-shrug.png'), ratio: 0.631 },
} as const;

export type PoseName = keyof typeof CUTOUTS;

// Мапінг логічних поз на файли art-v2/character/grindik (імена файлів стабільні: LoRA-канон прийде з тими ж іменами)
export const POSE_ART: Record<PoseName, ArtKey> = {
  stand: 'character/grindik/pose_arms',
  think: 'character/grindik/pose_think',
  cheer: 'character/grindik/pose_cheer',
  laptop: 'character/grindik/pose_laptop',
  rest: 'character/grindik/idle_coffee',
  phone: 'character/grindik/pose_phone',
  coin: 'character/grindik/pose_chest',
  wave: 'character/grindik/pose_wave',
  crown: 'character/grindik/pose_chest', // скриня золота в руках
  point: 'character/grindik/pose_point',
  shrug: 'character/grindik/pose_shrug',
};

export type PoseFile = { src: number; ratio: number; framed: boolean };

export function pose(name: PoseName): PoseFile {
  const a = art(POSE_ART[name]);
  return { src: a.src, ratio: a.ratio, framed: true };
}

export function poseCutout(name: PoseName): PoseFile {
  return { ...CUTOUTS[name], framed: false };
}

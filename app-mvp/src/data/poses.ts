// Пози Гріндіка = ПРОЗОРІ фігури (assets/art-v2/cutout/grindik): вони «стоять / висять» на UI з м'якою тінню, а не лежать у рамці.
// Старі 3D-clay вирізки прибрано з обігу. Імена файлів стабільні: LoRA-канон прийде з тими ж іменами (npm run art:build).
// ratio = ширина/висота файлу.
import { art, type ArtKey } from '../art';

export type PoseName = 'stand' | 'think' | 'cheer' | 'laptop' | 'rest' | 'phone' | 'coin' | 'wave' | 'crown' | 'point' | 'shrug';

// Мапінг логічних поз на файли
export const POSE_ART: Record<PoseName, ArtKey> = {
  stand: 'cutout/grindik/pose_arms',
  think: 'cutout/grindik/pose_think',
  cheer: 'cutout/grindik/pose_cheer',
  laptop: 'cutout/grindik/pose_laptop',
  rest: 'cutout/grindik/idle_coffee',
  phone: 'cutout/grindik/pose_phone',
  coin: 'cutout/grindik/pose_chest',
  wave: 'cutout/grindik/pose_wave',
  crown: 'cutout/grindik/pose_chest', // скриня золота в руках
  point: 'cutout/grindik/pose_point',
  shrug: 'cutout/grindik/pose_shrug',
};

export type PoseFile = { src: number; ratio: number; key: ArtKey };

export function pose(name: PoseName): PoseFile {
  const a = art(POSE_ART[name]);
  return { src: a.src, ratio: a.ratio, key: POSE_ART[name] };
}

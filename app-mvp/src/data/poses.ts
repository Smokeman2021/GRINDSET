// Пози Гріндіка (вирізані з 3D-рендера). ratio = ширина/висота файлу.
// Пози, яких ще нема, тимчасово підмінені найближчими: заміни запис на власний файл, коли він з’явиться.
const FILES = {
  stand: { src: require('../../assets/character/pose-stand.png'), ratio: 0.374 },
  think: { src: require('../../assets/character/pose-think.png'), ratio: 0.405 },
  cheer: { src: require('../../assets/character/pose-cheer.png'), ratio: 0.549 },
  laptop: { src: require('../../assets/character/pose-laptop.png'), ratio: 0.542 },
  rest: { src: require('../../assets/character/pose-rest.png'), ratio: 0.74 },
} as const;

type Ready = keyof typeof FILES;

// Ще не згенеровані: phone, coin, wave, crown, point, shrug
const PENDING = {
  phone: 'stand',
  coin: 'cheer',
  wave: 'cheer',
  crown: 'cheer',
  point: 'stand',
  shrug: 'think',
} as const satisfies Record<string, Ready>;

export type PoseName = Ready | keyof typeof PENDING;

export function pose(name: PoseName): { src: number; ratio: number } {
  const key: Ready = name in PENDING ? PENDING[name as keyof typeof PENDING] : (name as Ready);
  return FILES[key];
}

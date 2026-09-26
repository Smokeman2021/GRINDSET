// Пози Гріндіка (вирізані з 3D-рендера). ratio = ширина/висота файлу.
// coin: піднята розкрита долоня; під неї в коді підкидається монета (анімація ловлі).
const FILES = {
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

export type PoseName = keyof typeof FILES;

export function pose(name: PoseName): { src: number; ratio: number } {
  return FILES[name];
}

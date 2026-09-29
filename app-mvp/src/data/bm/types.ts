// Дані для реальних скріншотів Business Manager з клікабельними зонами (не намальований макет).
// Координати hotspot — у відсотках від зображення (0-100), тому не залежать від розміру екрана.
export type BmHotspot = { id: string; xPct: number; yPct: number; wPct: number; hPct: number; correct: boolean; feedback: string };
export type BmScreen = {
  id: string;
  title: string;
  talk: string;
  task: string;
  image: number; // require('...png')
  imgW: number; // натуральні пікселі скріншота — для правильного співвідношення сторін
  imgH: number;
  hotspots: BmHotspot[];
};

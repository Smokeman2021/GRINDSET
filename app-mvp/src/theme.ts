import { useMemo } from 'react';
import { useStore } from './store';

export type ThemeName = 'night' | 'day';

// Нічна тема (A): поточний темний стиль, дещо глибший. Денна (C): світла, як Duolingo.
export const NIGHT = {
  name: 'night' as ThemeName,
  bg: '#0d0f14',
  panel: '#171b24',
  panel2: '#1e2430',
  line: '#252c3a',
  txt: '#e8ecf2',
  muted: '#8b94a7',
  accent: '#36e27a',
  accent2: '#2bc465',
  accentEdge: '#1e9e55', // нижній 3D-край зелених кнопок
  onAccent: '#05140a', // текст на зеленому
  gold: '#ffce4d',
  goldEdge: '#c9982f',
  fire: '#ff7a3c',
  red: '#ff5c5c',
  redEdge: '#c23e3e',
  blue: '#5aa7ff',
  blueEdge: '#3d78c2',
  imgBg: '#0b0a0f', // фон 3D-рендерів Гріндіка
  goldTxt: '#ffce4d', // кольори тексту (на світлій темі темніші для контрасту)
  accentTxt: '#36e27a',
  blueTxt: '#5aa7ff',
  fireTxt: '#ff7a3c',
  redTxt: '#ff5c5c',
  goldTint: '#2a2410',
  track: '#191e28', // порожня частина смуг прогресу
  edge: '#0a0c10', // нижній край нейтральних кнопок і вузлів
  disabled: '#2a313f',
  disabledEdge: '#20262f',
  disabledTxt: '#5b6577',
  pathBed: '#151a23',
  pathDots: '#222a37',
  chip: '#0f2419', // м'який зелений фон плашок
  tabOn: '#1a2a20',
  accentTint: 'rgba(54,226,122,0.14)',
  redTint: 'rgba(255,92,92,0.12)',
  blueTint: 'rgba(90,167,255,0.12)',
  overlay: 'rgba(0,0,0,0.6)',
  shadow: '#000',
  shadowOpacity: 0.35,
};

export type Theme = { [K in keyof typeof NIGHT]: K extends 'name' ? ThemeName : (typeof NIGHT)[K] extends number ? number : string };

export const DAY: Theme = {
  name: 'day',
  bg: '#f3f6fb',
  panel: '#ffffff',
  panel2: '#eef2f8',
  line: '#e3e9f1',
  txt: '#1f2a37',
  muted: '#6b7686',
  accent: '#58cc02',
  accent2: '#4cb802',
  accentEdge: '#46a302',
  onAccent: '#ffffff',
  gold: '#ffc800',
  goldEdge: '#d9a600',
  fire: '#ff7a00',
  red: '#ff4b4b',
  redEdge: '#d93a3a',
  blue: '#1cb0f6',
  blueEdge: '#1899d6',
  imgBg: '#f3f6fb',
  goldTxt: '#b37a00',
  accentTxt: '#3d9100',
  blueTxt: '#0f8fd0',
  fireTxt: '#dd6200',
  redTxt: '#e03a3a',
  goldTint: '#fff4cc',
  track: '#e3e9f1',
  edge: '#cfd8e4',
  disabled: '#e3e9f1',
  disabledEdge: '#cfd8e4',
  disabledTxt: '#a3aebd',
  pathBed: '#e3e9f1',
  pathDots: '#cfd8e4',
  chip: '#e3f6cc',
  tabOn: '#e3f6cc',
  accentTint: 'rgba(88,204,2,0.14)',
  redTint: 'rgba(255,75,75,0.12)',
  blueTint: 'rgba(28,176,246,0.12)',
  overlay: 'rgba(31,42,55,0.5)',
  shadow: '#1f2a37',
  shadowOpacity: 0.08,
};

export const THEMES: Record<ThemeName, Theme> = { night: NIGHT as Theme, day: DAY };

// М'яка глибина під картками: у Ночі — розмите світіння, у Дні — короткий чіткий відступ (як у Duolingo)
export function cardShadow(C: Theme, size: 'sm' | 'md' | 'lg' = 'md') {
  const r = size === 'sm' ? 4 : size === 'lg' ? 14 : 8;
  return {
    shadowColor: C.shadow,
    shadowOpacity: C.shadowOpacity,
    shadowRadius: C.name === 'night' ? r : r / 3,
    shadowOffset: { width: 0, height: C.name === 'night' ? r / 2 : 2 },
    elevation: size === 'sm' ? 2 : size === 'lg' ? 8 : 4,
  } as const;
}

export function useTheme(): Theme {
  const name = useStore((s) => s.theme);
  return THEMES[name] ?? NIGHT;
}

// Стилі, що залежать від теми: const makeStyles = (C: Theme) => StyleSheet.create({...}); у компоненті: const styles = useStyles(makeStyles)
export function useStyles<T>(factory: (C: Theme) => T): T {
  const C = useTheme();
  return useMemo(() => factory(C), [C, factory]);
}

// Стани персонажа (емодзі-плейсхолдери; у проді — SVG/Lottie)
export const GR = {
  caveman: '🦴',
  sapiens: '🧠',
  early: '⚡',
  neutral: '😎',
  happy: '🤩',
  fire: '🔥',
  think: '🤔',
  oops: '😅',
} as const;

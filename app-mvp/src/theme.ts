export const C = {
  bg: '#0d0f14',
  panel: '#161a22',
  panel2: '#1e2430',
  line: '#2a313f',
  txt: '#e8ecf2',
  muted: '#8b94a7',
  accent: '#36e27a',
  accent2: '#2bc465',
  accentEdge: '#1e9e55', // нижній 3D-край зелених кнопок
  gold: '#ffce4d',
  goldEdge: '#c9982f',
  fire: '#ff7a3c',
  red: '#ff5c5c',
  redEdge: '#c23e3e',
  blue: '#5aa7ff',
  blueEdge: '#3d78c2',
  imgBg: '#0b0a0f', // фон 3D-рендерів Гріндіка
} as const;

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

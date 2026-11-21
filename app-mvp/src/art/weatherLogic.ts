// Чиста логіка погоди й часу доби для сцен. Без імпортів: перевіряється автотестами (supabase/tests/weather.test.ts).
// Реальна погода Києва береться з Open-Meteo (безкоштовно, без ключа, без персональних даних: лише координати міста).

export type SceneWeather = 'clear' | 'overcast' | 'rain' | 'snow' | 'fog';
export type DayPart = 'night' | 'dawn' | 'day' | 'dusk';

export const KYIV = { lat: 50.45, lon: 30.52 };

// WMO weather_code → наша спрощена погода (https://open-meteo.com/en/docs: Weather variable documentation)
export function mapWmo(code: number): SceneWeather {
  if (code === 0 || code === 1) return 'clear';
  if (code === 2 || code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain'; // мряка, дощ, зливи, гроза
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  return 'clear';
}

// Час доби за годинником пристрою (місцевий час). Межі прості й однакові круглий рік.
export function dayPart(date: Date): DayPart {
  const h = date.getHours();
  if (h >= 22 || h < 5) return 'night';
  if (h < 8) return 'dawn';
  if (h < 19) return 'day';
  return 'dusk';
}

export const forecastUrl = (c = KYIV) => `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=weather_code&timezone=auto`;

// Розбір відповіді Open-Meteo; null, якщо формат несподіваний
export function parseForecast(json: unknown): SceneWeather | null {
  const code = (json as { current?: { weather_code?: unknown } } | null)?.current?.weather_code;
  return typeof code === 'number' && Number.isFinite(code) ? mapWmo(code) : null;
}

// Стан сцени для рендера: який шар погоди й наскільки темно. Ручне перевизначення (для демо) бере гору.
export type SceneMode = 'auto' | 'off' | 'clear' | 'rain' | 'snow' | 'fog' | 'overcast' | 'night';
export type SceneState = { weather: SceneWeather; part: DayPart } | null;

export function resolveScene(mode: SceneMode, real: SceneWeather | null, now: Date): SceneState {
  if (mode === 'off') return null;
  if (mode === 'night') return { weather: 'clear', part: 'night' };
  if (mode !== 'auto') return { weather: mode, part: dayPart(now) };
  return { weather: real ?? 'clear', part: dayPart(now) };
}

// Параметри колір-корекції (LUT-імітація): накладка кольору + її непрозорість за станом
export function grade(s: SceneState): { tint: string; opacity: number } | null {
  if (!s) return null;
  let tint = '#000000';
  let opacity = 0;
  if (s.part === 'night') [tint, opacity] = ['#0a1638', 0.5];
  else if (s.part === 'dusk') [tint, opacity] = ['#3a1a40', 0.18];
  else if (s.part === 'dawn') [tint, opacity] = ['#2a3a60', 0.14];
  if (s.weather === 'overcast') [tint, opacity] = ['#7d8794', Math.max(opacity, 0.2)];
  if (s.weather === 'rain') [tint, opacity] = ['#4a5668', Math.max(opacity, 0.28)];
  if (s.weather === 'fog') [tint, opacity] = ['#cfd6de', Math.max(opacity, 0.3)];
  if (s.weather === 'snow') [tint, opacity] = ['#dfe9f5', Math.max(opacity, 0.16)];
  return opacity > 0 ? { tint, opacity } : null;
}

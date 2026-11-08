// Обгортка Telegram Mini App (етапи 1–2): тема, viewport / safe-area, MainButton / BackButton, хаптики, initData для входу.
// Скрипт telegram-web-app.js підвантажується лише коли застосунок запущено з Telegram (див. public/index.html), тож у звичайному
// браузері й у Expo Go все це мовчки вимкнено: tgWebApp() повертає null. Монетизація / Stars тут НЕ підключені.
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

type Inset = { top: number; bottom: number; left: number; right: number };

export type TgWebApp = {
  initData: string;
  initDataUnsafe: { user?: { id: number; username?: string; first_name?: string; language_code?: string }; auth_date?: number };
  version: string;
  platform: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string | undefined>;
  isExpanded: boolean;
  viewportHeight: number;
  viewportStableHeight: number;
  safeAreaInset?: Inset;
  contentSafeAreaInset?: Inset;
  ready: () => void;
  expand: () => void;
  close: () => void;
  setHeaderColor: (c: string) => void;
  setBackgroundColor: (c: string) => void;
  setBottomBarColor?: (c: string) => void;
  onEvent: (name: string, cb: () => void) => void;
  offEvent: (name: string, cb: () => void) => void;
  isVersionAtLeast: (v: string) => boolean;
  MainButton: {
    text: string;
    isVisible: boolean;
    isActive: boolean;
    setText: (t: string) => void;
    show: () => void;
    hide: () => void;
    enable: () => void;
    disable: () => void;
    onClick: (cb: () => void) => void;
    offClick: (cb: () => void) => void;
    setParams: (p: { text?: string; color?: string; text_color?: string; is_active?: boolean; is_visible?: boolean }) => void;
  };
  BackButton: { isVisible: boolean; show: () => void; hide: () => void; onClick: (cb: () => void) => void; offClick: (cb: () => void) => void };
  HapticFeedback: {
    impactOccurred: (s: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (t: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
};

// Справжній Mini App має непорожній initData (поза Telegram об'єкт Telegram.WebApp може існувати, але порожній)
export function tgWebApp(): TgWebApp | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const tg = (window as unknown as { Telegram?: { WebApp?: TgWebApp } }).Telegram?.WebApp;
  return tg && tg.initData ? tg : null;
}

export const isTelegram = () => tgWebApp() !== null;
export const telegramInitData = () => tgWebApp()?.initData ?? '';
export const telegramColorScheme = () => tgWebApp()?.colorScheme ?? null;

// Один раз при старті: повідомити Telegram, що застосунок готовий, розгорнути на весь екран, виставити CSS-змінну висоти
export function initTelegram(): void {
  const tg = tgWebApp();
  if (!tg || typeof document === 'undefined') return;
  tg.ready();
  tg.expand();
  const apply = () => {
    document.documentElement.style.setProperty('--tg-viewport-height', `${tg.viewportStableHeight || tg.viewportHeight}px`);
  };
  apply();
  tg.onEvent('viewportChanged', apply);
}

// Фон шапки/сторінки/нижньої панелі Telegram = фон поточної теми застосунку
export function syncTelegramColors(bg: string): void {
  const tg = tgWebApp();
  if (!tg) return;
  try {
    tg.setHeaderColor(bg);
    tg.setBackgroundColor(bg);
    tg.setBottomBarColor?.(bg);
  } catch {
    // старі версії Telegram: колір не змінюється, застосунок працює
  }
}

// Хаптики: у Telegram це HapticFeedback; поза ним нічого не робимо
export const haptic = {
  tap: () => tgWebApp()?.HapticFeedback.impactOccurred('light'),
  select: () => tgWebApp()?.HapticFeedback.selectionChanged(),
  success: () => tgWebApp()?.HapticFeedback.notificationOccurred('success'),
  error: () => tgWebApp()?.HapticFeedback.notificationOccurred('error'),
  warning: () => tgWebApp()?.HapticFeedback.notificationOccurred('warning'),
};

// Безпечні відступи Telegram (чубчик + його власна шапка): сума safeAreaInset і contentSafeAreaInset
export function useTelegramInsets(): { top: number; bottom: number } {
  const read = () => {
    const tg = tgWebApp();
    if (!tg) return { top: 0, bottom: 0 };
    return {
      top: (tg.safeAreaInset?.top ?? 0) + (tg.contentSafeAreaInset?.top ?? 0),
      bottom: (tg.safeAreaInset?.bottom ?? 0) + (tg.contentSafeAreaInset?.bottom ?? 0),
    };
  };
  const [v, setV] = useState(read);
  useEffect(() => {
    const tg = tgWebApp();
    if (!tg) return;
    const on = () => setV(read());
    tg.onEvent('safeAreaChanged', on);
    tg.onEvent('contentSafeAreaChanged', on);
    return () => {
      tg.offEvent('safeAreaChanged', on);
      tg.offEvent('contentSafeAreaChanged', on);
    };
  }, []);
  return v;
}

// MainButton Telegram: дзеркалить головну кнопку екрана. Повертає true, якщо кнопку Telegram використано (тоді власну можна сховати).
// onPress зберігається в ref: нова функція на кожен рендер не перереєструє обробник.
export function useTgMainButton(opts: { text: string; onPress: () => void; enabled?: boolean; visible?: boolean }): boolean {
  const tg = tgWebApp();
  const { text, onPress, enabled = true, visible = true } = opts;
  const ref = useRef(onPress);
  ref.current = onPress;
  useEffect(() => {
    if (!tg) return;
    const handler = () => ref.current();
    tg.MainButton.onClick(handler);
    return () => {
      tg.MainButton.offClick(handler);
      tg.MainButton.hide();
    };
  }, [tg]);
  useEffect(() => {
    if (!tg) return;
    tg.MainButton.setParams({ text, is_active: enabled, is_visible: visible, color: '#36e27a', text_color: '#0d0f14' });
  }, [tg, text, enabled, visible]);
  return !!tg && visible;
}

export function useTgBackButton(visible: boolean, onBack: () => void): void {
  const tg = tgWebApp();
  useEffect(() => {
    if (!tg) return;
    if (visible) tg.BackButton.show();
    else tg.BackButton.hide();
    tg.BackButton.onClick(onBack);
    return () => tg.BackButton.offClick(onBack);
  }, [tg, visible, onBack]);
}

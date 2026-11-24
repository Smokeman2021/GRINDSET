// Що показує екран входу (app/login.tsx) для кожного стану. Окремо від компонента, щоб покрити тестами (supabase/tests/login008.test.ts).
import type { LoginFailure, LoginInput } from './types';

export type LoginStatus = 'off' | 'loading' | 'signedOut' | 'denied' | 'replaced' | 'signedIn';
export type LoginDetail = { attemptsLeft?: number; lockedSeconds?: number } | null;

export type LoginView = {
  title: string;
  text: string;
  error: string | null;
  /** кнопка «Увійти через Telegram» (лише в Mini App): повторний вхід без коду */
  tgButton: boolean;
  /** форма @нік + код */
  form: boolean;
};

// Сервер відповідає 'wrong' і на хибний код, і на недійсний підпис Telegram. Якщо входили лише через Telegram (без ніка й коду),
// це саме підпис: показуємо окреме повідомлення замість «нік або код не збігаються».
export function loginReason(input: LoginInput, reason: LoginFailure): LoginFailure {
  const tgOnly = !input.username && !input.code && !!input.initData;
  return tgOnly && reason === 'wrong' ? 'tg_invalid' : reason;
}

export function loginView(status: LoginStatus, reason: LoginFailure | null, detail: LoginDetail, inTelegram: boolean): LoginView {
  const v: LoginView = {
    title: 'Вхід для запрошених',
    text: inTelegram
      ? 'Це закритий тест. Якщо тебе запросили, введи свій @нік і персональний код один раз: далі вхід із бота буде автоматичним.'
      : 'Це закритий тест. Введи свій @нік і персональний код, який тобі надіслали.',
    error: null,
    tgButton: false,
    form: true,
  };
  if (status === 'loading') return { ...v, title: inTelegram ? 'Входимо через Telegram' : v.title, form: false };
  if (status === 'denied') {
    return { ...v, title: 'Доступ вимкнено', text: 'Твій доступ до тесту вимкнено. Якщо це помилка, напиши тому, хто тебе запросив.', form: false };
  }
  if (status === 'replaced') {
    return {
      ...v,
      title: 'Вхід виконано з іншого пристрою',
      text: inTelegram
        ? 'Один акаунт може бути активним лише на одному пристрої. Щоб продовжити тут, увійди ще раз через Telegram: інший пристрій вийде.'
        : 'Один акаунт може бути активним лише на одному пристрої. Увійди ще раз, якщо хочеш продовжити тут.',
      tgButton: inTelegram,
    };
  }
  if (status !== 'signedOut' || !reason) return v;

  switch (reason) {
    case 'not_linked':
      return {
        ...v,
        title: 'Цей Telegram ще не привʼязаний',
        text: 'Якщо тебе запросили, один раз введи свій @нік і персональний код: Telegram привʼяжеться, і далі вхід буде без коду. Якщо запрошення немає, доступ закритий: напиши автору тесту.',
      };
    case 'tg_invalid':
      return {
        ...v,
        title: 'Не вдалося підтвердити Telegram',
        text: 'Закрий застосунок і відкрий його ще раз кнопкою в боті Гріндіка. Або увійди @ніком і кодом.',
        tgButton: inTelegram,
      };
    case 'wrong':
      return { ...v, error: `Нік або код не збігаються.${detail?.attemptsLeft != null ? ` Лишилось спроб: ${detail.attemptsLeft}.` : ''}` };
    case 'locked':
      return { ...v, error: `Забагато хибних спроб. Спробуй за ${Math.max(1, Math.ceil((detail?.lockedSeconds ?? 900) / 60))} хв.` };
    case 'too_many':
      return { ...v, error: 'Забагато спроб з цієї адреси. Зачекай кілька хвилин.', tgButton: inTelegram };
    default:
      return { ...v, error: 'Не вдалося звʼязатись із сервером. Спробуй ще раз за хвилину.', tgButton: inTelegram };
  }
}

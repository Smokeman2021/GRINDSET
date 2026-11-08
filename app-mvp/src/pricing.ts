// Ціни й пейвол. УВАГА: PAYWALL_ENABLED = false: нічого не блокується за гроші, ціни лише конфіг для майбутнього.
// Монетизація / Telegram Stars поки НЕ підключені. Усе, що захочемо «закрити за гроші», питатиме canAccess(feature), тож
// увімкнення пейволу це зміна цього файла, а не пошук по застосунку.
export const PAYWALL_ENABLED = false;

export const PRICING = {
  oneTimeUsd: 59, // разова покупка курсу
  subscriptionUsdPerMonth: 9.99, // підписка
  proUsd: 49, // Pro: на пів року (підтверджено автором 2026-11-02)
  proPeriodMonths: 6,
} as const;

export type Feature = 'course' | 'pro_tools' | 'leaderboard';

// Поки пейвол вимкнено: доступ відкритий до всього
export function canAccess(_feature: Feature): boolean {
  void _feature;
  return !PAYWALL_ENABLED ? true : false;
}

// Прапори функцій. Усе, що відкладене рішенням автора, сховане тут, але не видалене.
// «Мої цифри» (трекер власних кампаній): рішення 1.4 у docs/DECISIONS.md. Увімкнути: EXPO_PUBLIC_SHOW_MY_NUMBERS=true
// Старі 3D-clay аватари (12 архетипів × 10 стадій): рішення автора 2026-11-02 замінити їх новим конструктором на прозорих фігурах.
// Код і дані лишаються, секція в Профілі схована. Увімкнути: EXPO_PUBLIC_SHOW_LEGACY_AVATARS=true
export const SHOW_LEGACY_AVATARS = process.env.EXPO_PUBLIC_SHOW_LEGACY_AVATARS === 'true';
export const SHOW_MY_NUMBERS = process.env.EXPO_PUBLIC_SHOW_MY_NUMBERS === 'true';

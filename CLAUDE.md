# GRINDSET: інструкції для Claude Code

Gamified Duolingo-подібний застосунок для навчання арбітражу трафіку на Facebook. Автор і власник: Іван (Ioan), 11 років у темі, не програміст, пише українською, любить стислі фактичні відповіді. Еталон дизайну: Duolingo.

## Команди
- Застосунок: `app-mvp/` (Expo SDK 57, expo-router, TypeScript strict, Zustand + AsyncStorage).
- Типи: `cd app-mvp && npx tsc --noEmit` (Node: `C:\Program Files\nodejs`, на цьому ПК треба додавати в PATH).
- Веб-превʼю: конфіг `grindset-web` у `.claude/launch.json` (порт 8081). Телефон: Expo Go на `exp://<LAN-IP>:8081`.
- Контент модулів 03-10: правити `content/modules/*.md` і `content/overrides.json`, далі `node scripts/import-modules.mjs`. Не редагувати `app-mvp/src/data/generated/*.json` вручну.

## Структура
- `app-mvp/app/(tabs)/`: вкладки Уроки, Бібліотека, Магазин, Рейтинг, Профіль. Поза вкладками: `onboarding`, `diagnostic`, `lesson/[id]`, `results`.
- `app-mvp/src/store.ts`: весь стан гравця (persist). Нові поля мають значення за замовчуванням у `FRESH`.
- `app-mvp/src/data/`: уроки (`lessons.ts`, `module02.ts`, `content.ts`, `modules.ts`), віртуальні уроки (`virtual.ts`: помилки, діагностика, тренування), `phrases.ts` (репліки Гріндіка), `poses.ts`, `shop.ts`, `league.ts`, `quests.ts`, `achievements.ts`, `memes.ts`, `glossary.ts`, `library.ts`.
- Для змін контенту уроків і питань: тип кроку в `lessons.ts` (`teach | choice | fill | multi | order | match | numeric`).

## Рішення автора (діють, поки він не скасує)
- Продукт будується у повній задуманій формі за `GRINDSET_export/01_PRODUCT_VISION.md`, без урізань під сторі. Ризиковий контент, меми, жорсткий гумор, підколки Гріндіка на помилки: УВІМКНЕНІ. Прапор `EXPO_PUBLIC_INCLUDE_RESTRICTED=false` прибирає ризикові матеріали для збірки в стори.
- Гріндік: фіксований маскот (пози, репліки, меми). Аватари гравця (10 чол. + 10 жін.) заплановані окремо.
- Без ненависті до груп людей, без образ конкретних реальних людей.

## Секрети і чужі файли
- Токен Replicate лише в `.env` у корені (git-ignored). Ніколи не друкувати, не комітити, не просити вставляти в чат.
- Не комітити `.claude/settings.local.json` і `files.zip`.
- Гілка розробки `grindyk-real-renders`; у `main` зливає лише автор.

## Стиль коду
- Коментарі й тексти інтерфейсу українською, назви змінних англійською.
- Дизайн: нижня 3D-кромка на кнопках/картках (`borderBottomWidth` більший), кольори з `src/theme.ts`.
- Після змін: `npx tsc --noEmit`, перевірка у веб-превʼю, коміт з `Co-Authored-By`.

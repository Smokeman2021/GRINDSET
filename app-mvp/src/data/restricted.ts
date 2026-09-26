// Матеріали про обхід виявлення, купівлю/фарм акаунтів і клоакінг можуть не пройти модерацію App Store / Google Play
// і суперечать політикам Meta (див. GRINDSET_export/07_IMPROVEMENTS.md, 08_MVP_SPEC.md).
// За рішенням автора вони ВКЛЮЧЕНІ за замовчуванням. Для збірки в стори їх вимикають:
//   EXPO_PUBLIC_INCLUDE_RESTRICTED=false npx expo start   (або в EAS-профілі збірки)
export const INCLUDE_RESTRICTED = process.env.EXPO_PUBLIC_INCLUDE_RESTRICTED !== 'false';

// Той самий шаблон, що й у scripts/import-modules.mjs
const RESTRICT_RE = /клоак|антидетект|fingerprint|дофарм|проксі|акаунт-парк|купле\p{L}*\s+акаунт|(?<![\p{L}])фарм(?!ац|ак)/iu;

export const isRestricted = (text: string): boolean => RESTRICT_RE.test(text);

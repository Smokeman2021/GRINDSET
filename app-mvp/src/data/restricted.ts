// Матеріали про обхід виявлення, купівлю/фарм акаунтів і клоакінг ризиковані для App Store / Google Play
// і політик Meta (див. GRINDSET_export/07_IMPROVEMENTS.md, 08_MVP_SPEC.md). У репозиторії вони лишаються,
// а у збірку потрапляють лише коли цей прапорець true (наприклад, для веб-версії поза сторами).
export const INCLUDE_RESTRICTED = false;

// Той самий шаблон, що й у scripts/import-modules.mjs
const RESTRICT_RE = /клоак|антидетект|fingerprint|дофарм|проксі|акаунт-парк|купле\p{L}*\s+акаунт|(?<![\p{L}])фарм(?!ац|ак)/iu;

export const isRestricted = (text: string): boolean => RESTRICT_RE.test(text);

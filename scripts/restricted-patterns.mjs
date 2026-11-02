// Єдиний список слів для «другої перевірки» ризикового контенту (uk / en / ru).
// Основне джерело істини: content/restricted.json (позначки за ID фрагментів). Ці регулярки лише ловлять те, що забули позначити:
//  - scripts/import-modules.mjs: фрагмент зі збігом, якого нема в restricted.json, потрапляє у звіт (з --strict збірка падає)
//    і в публічному наборі однаково вирізається;
//  - scripts/check-restricted-bundle.mjs: фінальна перевірка готового бандла (вужча версія без слова «proxy»,
//    бо воно трапляється в коді бібліотек).

const uk = String.raw`клоак|антидетект|fingerprint|дофарм|проксі|акаунт-парк|купле\p{L}*\s+акаунт|(?<![\p{L}])фарм(?!ац|ак)`;
const en = String.raw`cloak(?:ing|ed)?|anti-?detect|fingerprint(?:ing)?|do-?pharm|do-?farm|(?:bought|buy(?:ing)?|purchased)\s+accounts?|account\s+farm(?:ing|er)?|warm(?:ing)?[- ]up\s+(?:of\s+)?accounts?`;
const ru = String.raw`клоак|антидетект|фингерпринт|дофарм|прогрев\p{L}*\s+аккаунт|(?<![\p{L}])фарм(?!ац|ак)|купленн\p{L}*\s+аккаунт|прокси`;

// у тексті контенту «proxy / проксі / прокси» теж ризикові
const enProxyBroad = String.raw`\bprox(?:y|ies)\b`;
// у бандлі код бібліотек містить Proxy, тому там лише фрази, що описують покупку/оренду
const enProxyNarrow = String.raw`(?:residential|mobile|datacenter|buy|rent(?:ing)?|cheap)\s+prox(?:y|ies)|prox(?:y|ies)\s+(?:server|provider|pool)s?`;

const make = (src) => new RegExp(src, 'giu');

export const FRAGMENT_PATTERNS = { uk: make(uk), en: make(`${en}|${enProxyBroad}`), ru: make(ru) };
export const BUNDLE_PATTERNS = { uk: make(uk), en: make(`${en}|${enProxyNarrow}`), ru: make(ru) };

// Чи є збіг у тексті (будь-якою мовою)
export function anyHit(text, patterns = FRAGMENT_PATTERNS) {
  return Object.values(patterns).some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

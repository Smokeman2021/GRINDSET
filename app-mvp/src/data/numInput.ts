// Числове поле (ТЗ 006, 5.3): ввід додатного й відʼємного числа без підказки знака відповіді. Чисті функції — під автотести.
// Однакова клавіатура (decimal-pad) і кнопка «±» в усіх числових полях; знак не підказується ні плейсхолдером, ні типом клавіатури.
// Десятковий роздільник — кома або крапка; пробіли між розрядами ігноруються; мінус — «-», «−» (U+2212) або «–».

export function parseNum(s: string): number {
  const t = String(s ?? '')
    .replace(/[\s  ]+/g, '')
    .replace(/[−–]/g, '-')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  if (!/^-?(\d+(\.\d*)?|\.\d+)$/.test(t)) return NaN;
  return parseFloat(t);
}

// «±»: додає або прибирає мінус на початку (типографський «−», як у текстах застосунку)
export function toggleSign(s: string): string {
  const t = String(s ?? '').trim();
  if (/^[-−–]/.test(t)) return t.replace(/^[-−–]\s*/, '');
  return `−${t}`;
}

export const NUM_KEYBOARD = 'decimal-pad' as const;
export const NUM_PLACEHOLDER = '0';

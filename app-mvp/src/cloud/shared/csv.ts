// CSV для вивантаження з екрана /admin (відгуки, тестери). Без імпортів: перевіряється автотестами (supabase/tests/csv.test.ts).
// Розділювач кома, рядки CRLF, лапки подвоюються. Клітинка, що починається з = + - @, отримує апостроф: захист від виконання формул
// у Excel/Sheets (текст відгуків пишуть тестери, довіряти йому не можна).

export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

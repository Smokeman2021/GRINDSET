// Відгуки (ТЗ 004, етап E2): контекст підставляється автоматично, черга для Claude експортується в Markdown для Ревізора.
// Чисті функції: використовуються екраном, бекендами й автотестами.

export type FbKind = 'bug' | 'idea' | 'comment' | 'proposal';
export type FbStatus = 'new' | 'queued' | 'done' | 'skip';

// Нові види для тестера; 'idea' — старий вид зі збірок до 26, показується як «пропозиція»
export const FB_KINDS: { kind: FbKind; label: string; icon: string }[] = [
  { kind: 'comment', label: 'Коментар', icon: '💬' },
  { kind: 'proposal', label: 'Пропозиція', icon: '💡' },
  { kind: 'bug', label: 'Баг', icon: '🐞' },
];
export const kindLabel = (k: string): string => (k === 'idea' ? 'Пропозиція' : FB_KINDS.find((x) => x.kind === k)?.label ?? k);
export const kindIcon = (k: string): string => (k === 'idea' ? '💡' : FB_KINDS.find((x) => x.kind === k)?.icon ?? '•');
export const STATUS_LABEL: Record<FbStatus, string> = { new: 'Нове', queued: 'В черзі для Claude', done: 'Зроблено', skip: 'Пропустити' };

export type FbContext = { screen: string; lessonId?: string; stepIdx?: number; branch?: string; simStep?: number };
export type FbFull = FbContext & { build: number; branch?: string };

// Контекст запису: збірка, екран, гілка (з ID уроку, якщо не передано), урок, крок, крок тренажера. Тестер нічого не вводить
export function feedbackContext(ctx: FbContext, build: number): FbFull {
  const branch = ctx.branch ?? /^BR-([A-Z]{3})-/.exec(ctx.lessonId ?? '')?.[1];
  return {
    build,
    screen: (ctx.screen || 'unknown').slice(0, 80),
    ...(ctx.lessonId ? { lessonId: ctx.lessonId } : {}),
    ...(typeof ctx.stepIdx === 'number' ? { stepIdx: ctx.stepIdx } : {}),
    ...(branch ? { branch } : {}),
    ...(typeof ctx.simStep === 'number' ? { simStep: ctx.simStep } : {}),
  };
}

// Рядок контексту для людини: «b26 · leads · гілка TOV · урок BR-TOV-FINAL · крок 14 · тренажер, крок 14»
export function contextLine(f: { build?: number | null; screen?: string | null; branch?: string | null; lessonId?: string | null; stepIdx?: number | null; simStep?: number | null }): string {
  const parts: string[] = [];
  if (f.build != null) parts.push(`b${f.build}`);
  parts.push(f.screen || '—');
  const branch = f.branch || /^BR-([A-Z]{3})-/.exec(f.lessonId ?? '')?.[1];
  if (branch) parts.push(`гілка ${branch}`);
  if (f.lessonId) parts.push(`урок ${f.lessonId}`);
  if (f.stepIdx != null) parts.push(`крок ${f.stepIdx + 1}`);
  if (f.simStep != null) parts.push(`тренажер, крок ${f.simStep + 1}`);
  return parts.join(' · ');
}

// Збірки до 0008 на сервері не знають нових видів і колонок: старий формат запису (вид → bug/idea, контекст — у текст)
export function legacyPayload(kind: FbKind, body: string, ctx: FbFull): { kind: 'bug' | 'idea'; body: string } {
  const extra = [ctx.branch ? `гілка ${ctx.branch}` : '', ctx.simStep != null ? `тренажер, крок ${ctx.simStep + 1}` : ''].filter(Boolean).join(', ');
  const tag = kind === 'comment' ? '[коментар] ' : kind === 'proposal' ? '[пропозиція] ' : '';
  return { kind: kind === 'bug' ? 'bug' : 'idea', body: `${tag}${body}${extra ? ` (${extra})` : ''}`.slice(0, 2000) };
}

export type QueueRow = {
  id: number;
  username: string;
  kind: string;
  screen: string;
  lessonId: string;
  stepIdx: number | null;
  branch?: string | null;
  simStep?: number | null;
  body: string;
  build: number | null;
  createdAt: number;
  note?: string | null;
  status?: FbStatus;
  useful?: boolean;
};

// Експорт черги «в черзі для Claude» у Markdown: відгук, контекст, помітка власника — для передачі Ревізору
export function queueMarkdown(rows: QueueRow[], now: Date = new Date()): string {
  const q = rows.filter((r) => r.status === 'queued').sort((a, b) => a.createdAt - b.createdAt);
  const out = [`# Черга відгуків для Claude`, '', `Вивантажено: ${now.toISOString().slice(0, 16).replace('T', ' ')} UTC · у черзі: ${q.length}`, ''];
  q.forEach((r, i) => {
    out.push(`## ${i + 1}. ${kindIcon(r.kind)} ${kindLabel(r.kind)} · #${r.id}${r.useful ? ' · ⭐ корисний' : ''}`);
    out.push('');
    out.push(`- **Контекст:** ${contextLine(r)}`);
    out.push(`- **Тестер:** @${r.username} · ${new Date(r.createdAt).toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    if (r.note) out.push(`- **Помітка власника:** ${r.note.replace(/\n+/g, ' ')}`);
    out.push('');
    out.push(...r.body.split('\n').map((l) => `> ${l}`));
    out.push('');
  });
  if (!q.length) out.push('Черга порожня.');
  return out.join('\n');
}

// Зведення внеску тестерів (видно лише власнику)
export function contributors(rows: QueueRow[]): { username: string; total: number; useful: number; lastAt: number }[] {
  const m = new Map<string, { username: string; total: number; useful: number; lastAt: number }>();
  for (const r of rows) {
    const c = m.get(r.username) ?? { username: r.username, total: 0, useful: 0, lastAt: 0 };
    c.total += 1;
    if (r.useful) c.useful += 1;
    c.lastAt = Math.max(c.lastAt, r.createdAt);
    m.set(r.username, c);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

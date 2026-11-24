// Пряме посилання й перезавантаження (ТЗ 006, 2.3). Чисті правила без React і стору — під автотести.
// Адреса, з якою відкрили застосунок, запамʼятовується до входу; після перевірки входу й завантаження прогресу стартовий екран
// відкриває її, якщо вона дійсна. Звичайний запуск через бота (корінь) → головна з «Продовжити».
// Недійсна (немає такого ID, урок недоступний) → екран /unavailable з переходом до доступного навчання.

export type LinkCtx = {
  kbExists: (id: string) => boolean;
  unit: (id: string) => { ready: boolean; sim?: boolean } | null; // одиниця гілки за ID
  branchExists: (code: string) => boolean;
  isAdmin: boolean;
};
export type LinkResult = { kind: 'none' } | { kind: 'open'; href: string } | { kind: 'invalid'; why: 'kb' | 'lesson' | 'branch' | 'route' };

// Статичні екрани, які можна відкрити з адреси напряму. results, onboarding, diagnostic, login — ні (потребують контексту дії).
const STATIC = new Set(['/home', '/library', '/shop', '/league', '/profile', '/settings', '/accuracy', '/character', '/leads', '/numbers', '/bm', '/plan', '/sim', '/adsim', '/handbook-sim', '/handbook-exam']);
const NEVER = new Set(['/', '', '/index', '/login', '/onboarding', '/diagnostic', '/results', '/unavailable']);
const ID_RE = /^[A-Za-z0-9_.:-]{1,64}$/;

export function resolveDeepLink(rawPath: string, ctx: LinkCtx): LinkResult {
  let p = (rawPath.split(/[?#]/)[0] ?? '').replace(/\/+$/, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    return { kind: 'invalid', why: 'route' };
  }
  if (NEVER.has(p)) return { kind: 'none' };
  if (STATIC.has(p)) return { kind: 'open', href: p };
  if (p === '/admin') return ctx.isAdmin ? { kind: 'open', href: p } : { kind: 'invalid', why: 'route' };
  const m = /^\/(kb|lesson|scene|branch|map|numbers)\/([^/]+)$/.exec(p);
  if (!m) return { kind: 'invalid', why: 'route' };
  const [, type, id] = m;
  if (!ID_RE.test(id)) return { kind: 'invalid', why: type === 'kb' ? 'kb' : type === 'lesson' || type === 'scene' ? 'lesson' : 'route' };
  if (type === 'scene') {
    const u = ctx.unit(id);
    return u && u.ready ? { kind: 'open', href: `/scene/${id}` } : { kind: 'invalid', why: 'lesson' };
  }
  if (type === 'kb') return ctx.kbExists(id) ? { kind: 'open', href: `/kb/${id}` } : { kind: 'invalid', why: 'kb' };
  if (type === 'lesson') {
    const u = ctx.unit(id);
    if (!u || !u.ready) return { kind: 'invalid', why: 'lesson' };
    return { kind: 'open', href: u.sim ? '/leads' : `/lesson/${id}` };
  }
  if (type === 'branch' || type === 'map') return ctx.branchExists(id) ? { kind: 'open', href: `/${type}/${id}` } : { kind: 'invalid', why: 'branch' };
  if (type === 'numbers') return { kind: 'open', href: `/numbers/${id}` };
  return { kind: 'invalid', why: 'route' };
}

// Адреса старту: запамʼятовується один раз при завантаженні бандла (до будь-якого перенаправлення на вхід)
let pending: string | null = null;
export function captureInitialLink(loc: { pathname: string; search?: string } | null | undefined): void {
  if (pending !== null || !loc) return;
  pending = loc.pathname + (loc.search ?? '');
}
export function takeInitialLink(): string | null {
  const p = pending;
  pending = '';
  return p || null;
}

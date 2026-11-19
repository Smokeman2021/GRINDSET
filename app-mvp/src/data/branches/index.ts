// Реєстр восьми гілок (порядок карток на екрані вибору) і доступ до одиниць за ID.
import type { BStep, Branch, Unit } from '../branch.ts';
import { branchCodeOf, lessonsWord, unitKind, type UnitKind } from '../branchRules.ts';
import { ACADEMY } from '../academy/courses.ts';
import { TOV } from './tov.ts';
import { SRV } from './srv.ts';
import { INF } from './inf.ts';
import { NUT } from './nut.ts';
import { DAT } from './dat.ts';
import { GAM } from './gam.ts';
import { CRY } from './cry.ts';
import { ADT } from './adt.ts';

export const BRANCHES: Branch[] = [TOV, SRV, INF, NUT, DAT, GAM, CRY, ADT];

export function getBranch(code: string | undefined): Branch | undefined {
  return ACADEMY.find((b) => b.code === code) ?? BRANCHES.find((b) => b.code === code);
}

export type UnitRef = { branch: Branch; kind: UnitKind; unit: Unit };

// Одиниця гілки за ID; самоперевірка збирається з двох завдань
export function unitById(id: string | undefined): UnitRef | undefined {
  if (!id) return undefined;
  const kind = unitKind(id);
  if (!kind) return undefined;
  const branch = getBranch(branchCodeOf(id) ?? undefined);
  if (!branch) return undefined;
  if (kind === 'selfcheck') return { branch, kind, unit: { id, title: `Самоперевірка · ${branch.title}`, steps: branch.selfcheck, kb: [], ready: true } };
  if (kind === 'practice') return { branch, kind, unit: branch.practice };
  if (kind === 'final') return branch.final ? { branch, kind, unit: branch.final } : undefined;
  const unit = branch.lessons.find((l) => l.id === id);
  return unit ? { branch, kind, unit } : undefined;
}

export const readyLessonIds = (b: Branch): string[] => b.lessons.filter((l) => l.ready).map((l) => l.id);

// Фактичний обсяг гілки для картки: «Вступ · Самоперевірка · 5 уроків · Фінал»
export function volumeLabel(b: Branch): string {
  const parts = ['Вступ', 'Самоперевірка'];
  const n = readyLessonIds(b).length;
  if (n > 0) parts.push(lessonsWord(n));
  if (b.final?.ready) parts.push('Фінал');
  return parts.join(' · ');
}

// Усі перевірювані кроки одиниці (для звіту і тестів)
export const questionSteps = (u: Unit): BStep[] => u.steps.filter((s) => s.type !== 'teach' && s.type !== 'reflect');

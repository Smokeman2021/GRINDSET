export const VERTICAL_CODES = ['TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT'] as const;
export type VerticalCode = typeof VERTICAL_CODES[number];
export const ACADEMY_CODES = ['STA', ...VERTICAL_CODES] as const;
export type AcademyTrack = typeof ACADEMY_CODES[number];
export type AcademyCode = `${AcademyTrack}-A1`;
import { handbookLessons } from './academy/handbookData.ts';
import { servicesLessons } from './academy/servicesLearning.ts';

export const ACADEMY_LESSONS = [...handbookLessons, ...servicesLessons];
export const HANDBOOK_TRACKS = ['STA', 'TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT', 'MOB', 'SWP', 'TTK'] as const;
export type HandbookTrack = typeof HANDBOOK_TRACKS[number];
export type HandbookCode = `${HandbookTrack}-A2`;

export function isHandbookCode(code: string): code is HandbookCode {
  return HANDBOOK_TRACKS.some((track) => code === `${track}-A2`);
}

export function isAcademyCodeV1(code: string): code is AcademyCode {
  return ACADEMY_CODES.some((track) => code === `${track}-A1`);
}

export function isAcademyCode(code: string): code is AcademyCode | HandbookCode {
  return isHandbookCode(code) || isAcademyCodeV1(code);
}

const handbookFinals = new Map<string, string>();
for (const entry of ACADEMY_LESSONS) {
  if (entry.isFinal) handbookFinals.set(entry.track, entry.id);
}

export function handbookRouteId(entry: { id: string; track: string }): string {
  return `BR-${entry.track}-A2-${handbookFinals.get(entry.track) === entry.id ? 'FINAL' : entry.id}`;
}

export function handbookLessonIds(code: HandbookCode): string[] {
  const track = code.slice(0, 3);
  return ACADEMY_LESSONS.filter((entry) => entry.track === track && entry.id !== handbookFinals.get(track)).map(handbookRouteId);
}

export function handbookBossPrerequisites(code: string, id: string): string[] {
  if (!isHandbookCode(code) || !id.startsWith(`BR-${code}-HB-`)) return [];
  const index = ACADEMY_LESSONS.findIndex((entry) => entry.isFinal && handbookRouteId(entry) === id);
  if (index < 0) return [];
  const boss = ACADEMY_LESSONS[index];
  return ACADEMY_LESSONS.slice(0, index).filter((entry) => entry.track === boss.track && entry.groupId === boss.groupId).map(handbookRouteId);
}

export function academyModuleCount(code: AcademyCode): number {
  return code === 'STA-A1' ? 6 : 10;
}
import { expansionContent } from './academy/expansionContent.ts';


export function academyUnits(code: AcademyCode, moduleIndex: number) {
  const group = code === 'STA-A1' ? 'START' : code.slice(0, 3);
  const module = `${group}-M${String(moduleIndex + 1).padStart(2, '0')}`;
  return expansionContent.filter((lesson) => lesson.module === module);
}

export const moduleOverviewId = (code: string, i: number) => `BR-${code}-L${String(i + 1).padStart(2, '0')}`;
export const moduleLessonId = (code: AcademyCode, key: string) => `BR-${code}-${key.split('-').slice(1).join('-')}`;

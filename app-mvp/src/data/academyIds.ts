export const VERTICAL_CODES = ['TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT'] as const;
export type VerticalCode = typeof VERTICAL_CODES[number];
export const ACADEMY_CODES = ['STA', ...VERTICAL_CODES] as const;
export type AcademyTrack = typeof ACADEMY_CODES[number];
export type AcademyCode = `${AcademyTrack}-A1`;

export function isAcademyCode(code: string): code is AcademyCode {
  return ACADEMY_CODES.some((track) => code === `${track}-A1`);
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

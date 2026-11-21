export const VERTICAL_CODES = ['TOV', 'SRV', 'INF', 'NUT', 'DAT', 'GAM', 'CRY', 'ADT'] as const;
export type VerticalCode = typeof VERTICAL_CODES[number];
export const ACADEMY_CODES = ['STA', ...VERTICAL_CODES] as const;
export type AcademyTrack = typeof ACADEMY_CODES[number];
export type AcademyCode = `${AcademyTrack}-A1`;

export function isAcademyCode(code: string): code is AcademyCode {
  return ACADEMY_CODES.some((track) => code === `${track}-A1`);
}

export function academyLessonCount(code: AcademyCode): number {
  return code === 'STA-A1' ? 6 : 10;
}

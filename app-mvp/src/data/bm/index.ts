import type { BmScreen } from './types';
import { BM_ADSMANAGER } from './adsmanager';

// Єдиний список усіх знятих екранів кабінету — звідси бере і карта (app/bm/index.tsx),
// і сам екран-в'юер (app/bm/[id].tsx). Коли зніматимемо інші розділи в окремі файли,
// просто додати їх сюди.
export const BM_SCREENS: BmScreen[] = [...BM_ADSMANAGER];

export function findBmScreen(id: string): BmScreen | undefined {
  return BM_SCREENS.find((s) => s.id === id);
}

const SECTION_LABELS: Record<string, string> = {
  'ads-manager': 'Ads Manager',
  'events-manager': 'Events Manager',
  billing: 'Оплата',
  'business-settings': 'Business Settings / Meta Business Suite',
};

export function bmSectionLabel(section: string): string {
  return SECTION_LABELS[section] ?? section;
}

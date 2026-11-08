import { useStore } from '../store';
import { STRINGS, StringKey, Lang } from './strings';

export type { Lang, StringKey };
export { LANG_LABEL } from './strings';

export function t(lang: Lang, key: StringKey): string {
  return STRINGS[lang][key] ?? STRINGS.uk[key];
}

// Хук: const t = useT(); t('tabProfile')
export function useT() {
  const lang = useStore((s) => s.lang);
  return (key: StringKey) => t(lang, key);
}

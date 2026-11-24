import { CLOUD_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { CloudBackend } from './types';

let instance: CloudBackend | null = null;

// Один екземпляр на застосунок. Справжній Supabase підвантажується лише в режимі supabase.
export function getBackend(): CloudBackend | null {
  if (CLOUD_MODE === 'off') return null;
  if (!instance) {
    if (CLOUD_MODE === 'mock') {
      const { MockBackend } = require('./mockBackend') as typeof import('./mockBackend');
      const mock = new MockBackend();
      instance = mock;
      // керування імітацією з консолі браузера (лише режим mock): режим запису і збереження «старою збіркою»
      if (typeof window !== 'undefined') {
        (window as unknown as { __grindsetMock?: unknown }).__grindsetMock = {
          mode: () => mock.mockMode(),
          setMode: (m: 'legacy' | 'v2') => mock.mockSetMode(m),
          legacySaveLocal: () => mock.mockLegacySaveLocal(),
          // скидання й відновлення (ТЗ 005): __grindsetMock.reset('run-1', ['tester_one']), __grindsetMock.restore('run-1', 'tester_one')
          reset: (run: string, ids: string[]) => mock.mockReset(run, ids),
          restore: (run: string, id: string) => mock.mockRestore(run, id),
        };
      }
    } else {
      const { SupabaseBackend } = require('./supabaseBackend') as typeof import('./supabaseBackend');
      instance = new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }
  return instance;
}

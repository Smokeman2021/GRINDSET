import { CLOUD_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from './config';
import type { CloudBackend } from './types';

let instance: CloudBackend | null = null;

// Один екземпляр на застосунок. Справжній Supabase підвантажується лише в режимі supabase.
export function getBackend(): CloudBackend | null {
  if (CLOUD_MODE === 'off') return null;
  if (!instance) {
    if (CLOUD_MODE === 'mock') {
      const { MockBackend } = require('./mockBackend') as typeof import('./mockBackend');
      instance = new MockBackend();
    } else {
      const { SupabaseBackend } = require('./supabaseBackend') as typeof import('./supabaseBackend');
      instance = new SupabaseBackend(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
  }
  return instance;
}

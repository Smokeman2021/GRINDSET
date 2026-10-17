import type { CloudMode } from './types';

// EXPO_PUBLIC_CLOUD: 'supabase' = справжній закритий вхід (збірка для Vercel), 'mock' = локальна імітація для розробки,
// не задано = застосунок працює як раніше, без входу. Змінні EXPO_PUBLIC_* потрібно читати саме так (статично), інакше збірка їх не підставить.
const raw = process.env.EXPO_PUBLIC_CLOUD;
export const CLOUD_MODE: CloudMode = raw === 'supabase' ? 'supabase' : raw === 'mock' ? 'mock' : 'off';

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const TELEGRAM_BOT = process.env.EXPO_PUBLIC_TELEGRAM_BOT ?? '';

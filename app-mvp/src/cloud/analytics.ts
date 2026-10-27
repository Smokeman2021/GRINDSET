import { getBackend } from './backend';
import { useCloud } from './cloudStore';
import type { EventName } from './shared/analytics';

// Подія мініаналітики. Нічого не робить поза закритим режимом чи без входу; помилок не кидає й не чекає відповіді.
export function track(name: EventName, props?: Record<string, unknown>): void {
  if (useCloud.getState().status !== 'signedIn') return;
  void getBackend()?.trackEvent(name, props);
}

import React from 'react';
import { create } from 'zustand';
import { getBackend } from './backend';
import { CLOUD_MODE } from './config';
import { startProgressSync, stopProgressSync } from './progressSync';
import type { CloudMode, CloudUser, LoginFailure, LoginInput } from './types';

// off — хмара вимкнена (застосунок без входу); loading — перевіряємо сеанс; signedOut — потрібен вхід;
// denied — доступ вимкнено (заблоковано); replaced — вхід виконано з іншого пристрою; signedIn — усе добре
export type CloudStatus = 'off' | 'loading' | 'signedOut' | 'denied' | 'replaced' | 'signedIn';

type CloudState = {
  mode: CloudMode;
  status: CloudStatus;
  user: CloudUser | null;
  reason: LoginFailure | null;
  detail: { attemptsLeft?: number; lockedSeconds?: number } | null;
  init: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => Promise<void>;
  verify: () => Promise<void>;
  retry: () => void;
};

const DENIED: LoginFailure[] = ['blocked'];

export const useCloud = create<CloudState>((set, get) => {
  const markReplaced = async () => {
    await stopProgressSync(false);
    await getBackend()?.logout(); // не чіпає чужий (новий) активний сеанс: логіка перевіряє збіг sid
    set({ status: 'replaced', user: null });
  };

  const enter = (user: CloudUser) => {
    set({ status: 'signedIn', user, reason: null });
    const backend = getBackend();
    if (backend) void startProgressSync(backend, user, markReplaced);
  };

  return {
    mode: CLOUD_MODE,
    status: CLOUD_MODE === 'off' ? 'off' : 'loading',
    user: null,
    reason: null,
    detail: null,

    async init() {
      const backend = getBackend();
      if (!backend) return;
      try {
        const user = await backend.restore();
        if (!user) return set({ status: 'signedOut' });
        const check = await backend.checkSession();
        if (check === 'ok') enter(user);
        else if (check === 'replaced') await markReplaced();
        else set({ status: 'signedOut', user: null });
      } catch {
        set({ status: 'signedOut', user: null });
      }
    },

    async login(input) {
      const backend = getBackend();
      if (!backend) return;
      set({ status: 'loading', reason: null, detail: null });
      const res = await backend.login(input);
      if (res.ok) return enter(res.user);
      set({
        status: DENIED.includes(res.reason) ? 'denied' : 'signedOut',
        reason: res.reason,
        detail: { attemptsLeft: res.attemptsLeft, lockedSeconds: res.lockedSeconds },
        user: null,
      });
    },

    async logout() {
      await stopProgressSync(true);
      await getBackend()?.logout();
      set({ status: 'signedOut', user: null, reason: null });
    },

    // Періодична перевірка «один активний сеанс»
    async verify() {
      const backend = getBackend();
      if (!backend || get().status !== 'signedIn') return;
      try {
        const check = await backend.checkSession();
        if (check === 'replaced') await markReplaced();
        else if (check === 'signed_out') {
          await stopProgressSync(false);
          set({ status: 'signedOut', user: null });
        }
      } catch {
        // немає мережі: перевіримо наступного разу
      }
    },

    retry() {
      set({ status: 'signedOut', reason: null, detail: null });
    },
  };
});

// Один раз при старті: підняти сеанс і стежити, чи його не замінили (раз на хвилину і при поверненні на вкладку)
export function useCloudBoot() {
  React.useEffect(() => {
    if (CLOUD_MODE === 'off') return;
    void useCloud.getState().init();
    const tick = setInterval(() => void useCloud.getState().verify(), 60000);
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') void useCloud.getState().verify();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(tick);
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
}

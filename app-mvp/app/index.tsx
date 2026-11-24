import React, { useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useStore } from '../src/store';
import { CLOUD_MODE } from '../src/cloud/config';
import { useCloud } from '../src/cloud/cloudStore';
import { useSyncReady } from '../src/cloud/progressSync';
import { Theme, useTheme } from '../src/theme';
import { resolveDeepLink, takeInitialLink, type LinkResult } from '../src/data/deepLink';
import { kbMeta } from '../src/data/kb';
import { getBranch, unitById } from '../src/data/branches';

export default function Index() {
  const C = useTheme();
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.onboarded);
  const signedIn = useCloud((s) => s.status === 'signedIn');
  const isAdmin = useCloud((s) => !!s.user?.isAdmin);
  const syncReady = useSyncReady((s) => s.ready);
  // закритий режим: спершу прогрес із сервера, інакше чистий пристрій відкрив би онбординг як новий користувач (CS2)
  const waiting = !hydrated || (CLOUD_MODE !== 'off' && signedIn && !syncReady);
  // пряме посилання / перезавантаження (ТЗ 006, 2.3): відкриваємо лише після входу й завантаження прогресу, один раз
  const link = useRef<LinkResult | null>(null);

  if (waiting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.accentTxt} />
      </View>
    );
  }
  if (!onboarded) return <Redirect href="/onboarding" />;
  if (link.current === null) {
    const raw = takeInitialLink();
    link.current = raw
      ? resolveDeepLink(raw, {
          kbExists: (id) => !!kbMeta(id),
          unit: (id) => {
            const r = unitById(id);
            return r ? { ready: !!r.unit.ready && (r.unit.steps.length > 0 || !!r.unit.sim), sim: r.unit.sim === 'leads' } : null;
          },
          branchExists: (code) => !!getBranch(code),
          isAdmin,
        })
      : { kind: 'none' };
  }
  if (link.current.kind === 'open') return <Redirect href={link.current.href as never} />;
  if (link.current.kind === 'invalid') return <Redirect href={{ pathname: '/unavailable', params: { why: link.current.why } }} />;
  return <Redirect href="/home" />;
}

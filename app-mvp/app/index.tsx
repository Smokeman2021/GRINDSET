import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useStore } from '../src/store';
import { CLOUD_MODE } from '../src/cloud/config';
import { useCloud } from '../src/cloud/cloudStore';
import { useSyncReady } from '../src/cloud/progressSync';
import { Theme, useTheme } from '../src/theme';

export default function Index() {
  const C = useTheme();
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.onboarded);
  const signedIn = useCloud((s) => s.status === 'signedIn');
  const syncReady = useSyncReady((s) => s.ready);
  // закритий режим: спершу прогрес із сервера, інакше чистий пристрій відкрив би онбординг як новий користувач (CS2)
  const waiting = !hydrated || (CLOUD_MODE !== 'off' && signedIn && !syncReady);

  if (waiting) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.accentTxt} />
      </View>
    );
  }

  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}

import React from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useStore } from '../src/store';
import { Theme, useTheme } from '../src/theme';

export default function Index() {
  const C = useTheme();
  const hydrated = useStore((s) => s.hydrated);
  const onboarded = useStore((s) => s.onboarded);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center' }}>
        <ActivityIndicator color={C.accentTxt} />
      </View>
    );
  }

  return <Redirect href={onboarded ? '/home' : '/onboarding'} />;
}

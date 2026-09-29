import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { initAudio } from '../src/sound';

export default function RootLayout() {
  const C = useTheme();
  React.useEffect(() => {
    initAudio();
  }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style={C.name === 'night' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: C.bg },
          animation: 'fade',
        }}
      />
    </SafeAreaProvider>
  );
}

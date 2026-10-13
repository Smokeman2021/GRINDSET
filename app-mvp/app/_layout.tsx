import React from 'react';
import { Platform } from 'react-native';
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
    <SafeAreaProvider style={{ backgroundColor: C.bg }}>
      <StatusBar style={C.name === 'night' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShown: false,
          // веб: контент не ширший за ~600 px по центру (вкладки самі обмежують свої сцени й мають бічну навігацію на широких екранах)
          contentStyle: Platform.OS === 'web' ? { backgroundColor: C.bg, width: '100%', maxWidth: 600, marginHorizontal: 'auto' } : { backgroundColor: C.bg },
          animation: 'fade',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: C.bg } }} />
      </Stack>
    </SafeAreaProvider>
  );
}

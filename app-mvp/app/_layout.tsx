import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { initAudio } from '../src/sound';
import { CLOUD_MODE } from '../src/cloud/config';
import { useCloud, useCloudBoot } from '../src/cloud/cloudStore';

// Усі маршрути застосунку, окрім login: за закритого тесту доступні лише після входу. Новий файл у app/ ОБОВʼЯЗКОВО додати сюди,
// інакше він лишиться відкритим для всіх (перевіряє scripts/check-routes-protected.mjs).
const PROTECTED_ROUTES = [
  'index',
  '(tabs)',
  'onboarding',
  'diagnostic',
  'lesson/[id]',
  'results',
  'settings',
  'accuracy',
  'admin',
  'plan',
  'adapt',
  'adsim',
  'sim',
  'bm/index',
  'numbers/index',
  'numbers/[id]',
];

export default function RootLayout() {
  const C = useTheme();
  const status = useCloud((s) => s.status);
  const gateOn = CLOUD_MODE !== 'off';
  const signedIn = !gateOn || status === 'signedIn';
  useCloudBoot();
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
        <Stack.Protected guard={signedIn}>
          {PROTECTED_ROUTES.map((name) => (
            <Stack.Screen key={name} name={name} options={name === '(tabs)' ? { contentStyle: { backgroundColor: C.bg } } : undefined} />
          ))}
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
    </SafeAreaProvider>
  );
}

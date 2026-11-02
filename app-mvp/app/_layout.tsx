import React from 'react';
import { Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../src/theme';
import { initAudio } from '../src/sound';
import { CLOUD_MODE } from '../src/cloud/config';
import { useCloud, useCloudBoot } from '../src/cloud/cloudStore';
import { initTelegram, isTelegram, syncTelegramColors, useTelegramInsets, useTgBackButton } from '../src/telegram/webapp';
import { usePathname, useRouter } from 'expo-router';

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
  'character',
  'admin',
  'plan',
  'adapt',
  'adsim',
  'sim',
  'bm/index',
  'numbers/index',
  'numbers/[id]',
];

// Веб: фон сторінки й колір адресного рядка = фон поточної теми, щоб ніде не світилась біла смуга (за межами колонки на десктопі, під адресним рядком)
function useWebChrome(bg: string) {
  React.useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    document.documentElement.style.backgroundColor = bg;
    document.body.style.backgroundColor = bg;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  }, [bg]);
}

// Маршрути «першого рівня»: на них кнопки «Назад» Telegram не показуємо
const ROOT_PATHS = new Set(['/', '/home', '/library', '/shop', '/league', '/profile', '/login', '/onboarding']);

// Telegram Mini App: готовність, кольори під тему, BackButton (повертає назад на вкладених екранах), безпечні відступи
function TelegramBridge({ bg }: { bg: string }) {
  const pathname = usePathname();
  const router = useRouter();
  React.useEffect(() => {
    initTelegram();
  }, []);
  React.useEffect(() => {
    syncTelegramColors(bg);
  }, [bg]);
  const nested = !ROOT_PATHS.has(pathname);
  useTgBackButton(nested, () => (router.canGoBack() ? router.back() : router.replace('/home')));
  return null;
}

export default function RootLayout() {
  const C = useTheme();
  useWebChrome(C.bg);
  const tgInsets = useTelegramInsets();
  const status = useCloud((s) => s.status);
  const gateOn = CLOUD_MODE !== 'off';
  const signedIn = !gateOn || status === 'signedIn';
  useCloudBoot();
  React.useEffect(() => {
    initAudio();
  }, []);
  return (
    <SafeAreaProvider style={{ backgroundColor: C.bg, paddingTop: tgInsets.top, paddingBottom: tgInsets.bottom }}>
      <StatusBar style={C.name === 'night' ? 'light' : 'dark'} />
      {Platform.OS === 'web' && isTelegram() && <TelegramBridge bg={C.bg} />}
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

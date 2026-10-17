import React from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { META_DISCLAIMER } from '../src/brand';
import { CLOUD_MODE, TELEGRAM_BOT } from '../src/cloud/config';
import { useCloud } from '../src/cloud/cloudStore';
import { TelegramLoginButton } from '../src/cloud/TelegramLoginButton';
import type { TelegramPayload } from '../src/cloud/shared/telegramAuth';
import { Theme, useStyles, useTheme } from '../src/theme';

const BUST = require('../assets/grindyk-bust.png');

// Екран входу закритого тесту. Показується замість усього застосунку, доки сервер не підтвердить сеанс (див. app/_layout.tsx).
export default function Login() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { status, reason, login, retry } = useCloud();

  const MockForm = CLOUD_MODE === 'mock' ? (require('../src/cloud/MockTelegramForm') as typeof import('../src/cloud/MockTelegramForm')).MockTelegramForm : null;
  const onAuth = React.useCallback((p: TelegramPayload) => void login(p), [login]);

  let title = 'Вхід для запрошених';
  let text = 'Це закритий тест. Увійди через Telegram: пустимо лише тих, кого запросили.';
  if (status === 'denied') {
    title = 'Доступ лише для запрошених';
    text =
      reason === 'no_username'
        ? 'У твоєму Telegram нема @username. Додай його в налаштуваннях Telegram (Імʼя користувача) і спробуй знову.'
        : 'Тебе нема у списку запрошених (або доступ вимкнено). Якщо це помилка, напиши тому, хто тебе запросив.';
  } else if (status === 'replaced') {
    title = 'Вхід виконано з іншого пристрою';
    text = 'Один акаунт може бути активним лише на одному пристрої. Увійди ще раз, якщо хочеш продовжити тут.';
  } else if (status === 'signedOut' && reason && reason !== 'invite_only') {
    title = 'Не вдалося увійти';
    text = reason === 'expired' ? 'Вхід застарів. Спробуй ще раз.' : 'Щось пішло не так. Спробуй ще раз за хвилину.';
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.avatar}>
        <Image source={BUST} style={{ width: '100%', height: '100%' }} />
      </View>
      <Text style={styles.h1}>{title}</Text>
      <Text style={styles.p}>{text}</Text>

      {status === 'loading' ? (
        <ActivityIndicator color={C.accentTxt} style={{ marginTop: 24 }} />
      ) : status === 'denied' ? (
        <View style={{ width: '100%', marginTop: 20 }}>
          <Button title="Спробувати іншим акаунтом" onPress={retry} />
        </View>
      ) : (
        <View style={styles.box}>{MockForm ? <MockForm onAuth={onAuth} /> : <TelegramLoginButton bot={TELEGRAM_BOT} onAuth={onAuth} />}</View>
      )}

      <Text style={styles.small}>{META_DISCLAIMER.uk}</Text>
    </ScrollView>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    wrap: { alignItems: 'center', paddingHorizontal: 24, gap: 12 },
    avatar: { width: 96, height: 96, borderRadius: 48, overflow: 'hidden', backgroundColor: C.imgBg, borderWidth: 3, borderColor: C.accent, borderBottomWidth: 6, borderBottomColor: C.accentEdge },
    h1: { color: C.txt, fontSize: 24, fontWeight: '900', textAlign: 'center', marginTop: 8 },
    p: { color: C.muted, fontSize: 15, lineHeight: 22, textAlign: 'center' },
    box: { width: '100%', alignItems: 'center', marginTop: 12 },
    small: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 24, opacity: 0.8 },
  });

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { META_DISCLAIMER } from '../src/brand';
import { CLOUD_MODE } from '../src/cloud/config';
import { useCloud } from '../src/cloud/cloudStore';
import { formatInviteCode, normalizeInviteCode } from '../src/cloud/shared/access';
import { localKv } from '../src/cloud/storage';
import { Theme, useStyles, useTheme } from '../src/theme';

const BUST = require('../assets/grindyk-bust.png');
const NICK_KEY = 'grindset-last-nick';

// Екран входу закритого тесту: @нік + персональний код доступу. Показується замість усього застосунку, доки сервер не підтвердить
// сеанс (див. app/_layout.tsx).
export default function Login() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { status, reason, detail, login, retry } = useCloud();
  const [nick, setNick] = useState('');
  const [code, setCode] = useState('');

  useEffect(() => {
    void localKv.get(NICK_KEY).then((v) => v && setNick(v));
  }, []);

  const mockAccounts = CLOUD_MODE === 'mock' ? (require('../src/cloud/mockBackend') as typeof import('../src/cloud/mockBackend')).MOCK_ACCOUNTS : [];
  const ready = nick.trim().length > 0 && normalizeInviteCode(code).length === 12;

  const submit = () => {
    if (!ready) return;
    const username = nick.trim().replace(/^@/, '');
    void localKv.set(NICK_KEY, username);
    void login({ username, code });
  };

  let title = 'Вхід для запрошених';
  let text = 'Це закритий тест. Введи свій @нік і персональний код, який тобі надіслали.';
  let error: string | null = null;
  if (status === 'denied') {
    title = 'Доступ вимкнено';
    text = 'Твій доступ до тесту вимкнено. Якщо це помилка, напиши тому, хто тебе запросив.';
  } else if (status === 'replaced') {
    title = 'Вхід виконано з іншого пристрою';
    text = 'Один акаунт може бути активним лише на одному пристрої. Увійди ще раз, якщо хочеш продовжити тут.';
  } else if (status === 'signedOut' && reason) {
    if (reason === 'wrong') error = `Нік або код не збігаються.${detail?.attemptsLeft != null ? ` Лишилось спроб: ${detail.attemptsLeft}.` : ''}`;
    else if (reason === 'locked') error = `Забагато хибних спроб. Спробуй за ${Math.max(1, Math.ceil((detail?.lockedSeconds ?? 900) / 60))} хв.`;
    else if (reason === 'too_many') error = 'Забагато спроб з цієї адреси. Зачекай кілька хвилин.';
    else error = 'Не вдалося звʼязатись із сервером. Спробуй ще раз за хвилину.';
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={[styles.wrap, { paddingTop: insets.top + 36, paddingBottom: insets.bottom + 24 }]}
      keyboardShouldPersistTaps="handled"
    >
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
        <View style={styles.box}>
          <Text style={styles.label}>Твій @нік</Text>
          <TextInput
            style={styles.input}
            value={nick}
            onChangeText={setNick}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="username"
            placeholderTextColor={C.muted}
            accessibilityLabel="Нік"
          />
          <Text style={styles.label}>Код доступу</Text>
          <TextInput
            style={[styles.input, styles.codeInput]}
            value={code}
            onChangeText={(v) => setCode(formatInviteCode(normalizeInviteCode(v).slice(0, 12)))}
            autoCapitalize="characters"
            autoCorrect={false}
            placeholder="XXXX-XXXX-XXXX"
            placeholderTextColor={C.muted}
            maxLength={14}
            onSubmitEditing={submit}
            accessibilityLabel="Код доступу"
          />
          {error && <Text style={styles.error}>{error}</Text>}
          <View style={{ marginTop: 6 }}>
            <Button title="Увійти" onPress={submit} disabled={!ready} />
          </View>

          {mockAccounts.length > 0 && (
            <View style={styles.mock}>
              <Text style={styles.mockTag}>ІМІТАЦІЯ СЕРВЕРА · ТЕСТОВІ ДАНІ ДЛЯ РОЗРОБКИ</Text>
              <View style={styles.chips}>
                {mockAccounts.map((a) => (
                  <Pressable
                    key={a.username}
                    onPress={() => {
                      setNick(a.username);
                      setCode(a.code);
                    }}
                    style={styles.chip}
                  >
                    <Text style={styles.chipTxt}>{a.username}</Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => {
                    setNick('tester_one');
                    setCode('WRNG-CODE-9999');
                  }}
                  style={styles.chip}
                >
                  <Text style={styles.chipTxt}>хибний код</Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
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
    box: { width: '100%', marginTop: 12, gap: 6 },
    label: { color: C.muted, fontSize: 12, fontWeight: '800', marginTop: 4 },
    input: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 2, borderRadius: 14, padding: 13, color: C.txt, fontSize: 17, fontWeight: '700' },
    codeInput: { letterSpacing: 2, textAlign: 'center' },
    error: { color: C.redTxt, fontSize: 13, fontWeight: '700', marginTop: 4 },
    small: { color: C.muted, fontSize: 10, textAlign: 'center', marginTop: 24, opacity: 0.8 },
    mock: { marginTop: 18, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel2, gap: 6 },
    mockTag: { color: C.goldTxt, fontSize: 9, fontWeight: '900', letterSpacing: 1 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line },
    chipTxt: { color: C.txt, fontSize: 11, fontWeight: '700' },
  });

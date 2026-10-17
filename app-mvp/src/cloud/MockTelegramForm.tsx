import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button } from '../components/Button';
import { Theme, useStyles, useTheme } from '../theme';
import { mockSignPayload } from './mockBackend';
import type { TelegramPayload } from './shared/telegramAuth';

// Замінник кнопки Telegram у режимі-імітації: формує підписані дані, як віджет. Лише для розробки.
const QUICK: { label: string; username: string; id: string }[] = [
  { label: 'admin_me', username: 'admin_me', id: '101' },
  { label: 'tester_one', username: 'tester_one', id: '202' },
  { label: 'tester_one з іншим id', username: 'tester_one', id: '999' },
  { label: 'blocked_guy', username: 'blocked_guy', id: '404' },
  { label: 'стороння людина', username: 'stranger', id: '505' },
  { label: 'без @username', username: '', id: '606' },
];

export function MockTelegramForm({ onAuth }: { onAuth: (p: TelegramPayload) => void }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [username, setUsername] = useState('tester_one');
  const [id, setId] = useState('202');

  const submit = async () => {
    const num = Number(id);
    if (!Number.isFinite(num) || num <= 0) return;
    onAuth(await mockSignPayload({ id: num, username: username.trim().replace(/^@/, '') || undefined, first_name: username || 'Користувач' }));
  };

  return (
    <View style={styles.box}>
      <Text style={styles.tag}>ІМІТАЦІЯ TELEGRAM · ЛИШЕ ДЛЯ РОЗРОБКИ</Text>
      <Text style={styles.label}>@username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} autoCapitalize="none" placeholder="username" placeholderTextColor={C.muted} />
      <Text style={styles.label}>Telegram id</Text>
      <TextInput style={styles.input} value={id} onChangeText={setId} keyboardType="number-pad" placeholder="id" placeholderTextColor={C.muted} />
      <View style={styles.chips}>
        {QUICK.map((q) => (
          <Pressable
            key={q.label}
            onPress={() => {
              setUsername(q.username);
              setId(q.id);
            }}
            style={styles.chip}
          >
            <Text style={styles.chipTxt}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
      <Button title="Увійти (імітація Telegram)" onPress={submit} />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    box: { width: '100%', backgroundColor: C.panel, borderRadius: 16, borderWidth: 2, borderColor: C.line, padding: 14, gap: 6 },
    tag: { color: C.goldTxt, fontSize: 10, fontWeight: '900', letterSpacing: 1 },
    label: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 6 },
    input: { backgroundColor: C.panel2, borderColor: C.line, borderWidth: 2, borderRadius: 12, padding: 10, color: C.txt, fontSize: 16 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 },
    chip: { paddingVertical: 5, paddingHorizontal: 9, borderRadius: 10, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
    chipTxt: { color: C.txt, fontSize: 11, fontWeight: '700' },
  });

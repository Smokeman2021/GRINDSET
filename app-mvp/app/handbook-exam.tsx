import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { Markdown } from '../src/components/Markdown';
import { handbookExam } from '../src/data/academy/handbookData';
import { Theme, useStyles, useTheme } from '../src/theme';

export default function HandbookExam() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 28, gap: 14 }}>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/home')}><Text style={styles.link}>← Академія</Text></Pressable>
      <Text style={styles.title}>{handbookExam.title}</Text>
      <Markdown text={handbookExam.practice} handbook />
      <View style={styles.panel}>
        <Text style={styles.label}>Твій запис перед звіркою</Text>
        <TextInput style={styles.input} accessibilityLabel="Твій запис перед звіркою" multiline value={draft} onChangeText={setDraft} placeholder="Рішення, докази та наступний крок. Або напиши, де зберіг свої відповіді." placeholderTextColor={C.muted} />
        <Button title={showKey ? 'Згорнути розбір' : 'Звірити відповіді'} disabled={!draft.trim()} onPress={() => setShowKey((value) => !value)} />
      </View>
      {showKey && <><Text style={styles.label}>Розбір для самоперевірки</Text><Markdown text={handbookExam.solution} handbook /></>}
    </ScrollView>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, title: { color: C.txt, fontSize: 25, fontWeight: '900' },
  label: { color: C.txt, fontSize: 16, fontWeight: '800' }, link: { color: C.blueTxt, fontWeight: '800' },
  panel: { padding: 12, gap: 10, borderRadius: 12, borderWidth: 1, borderColor: C.line, backgroundColor: C.panel },
  input: { minHeight: 100, padding: 10, textAlignVertical: 'top', color: C.txt, backgroundColor: C.bg, borderWidth: 1, borderColor: C.line, borderRadius: 8 },
});

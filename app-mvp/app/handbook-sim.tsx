import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { handbookSandboxCases } from '../src/data/academy/handbookData';
import { sandboxRun, type SandboxDecision, type SandboxSlice } from '../src/data/academy/handbookSandbox';
import { useStore } from '../src/store';
import { Theme, useStyles, useTheme } from '../src/theme';

const money = (value: number) => `${value < 0 ? '−' : ''}$${Math.abs(value).toFixed(2)}`;

export default function HandbookSandbox() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const started = useStore((state) => state.completed.includes('BR-STA-A2-FINAL'));
  const [index, setIndex] = useState(0);
  const [scale, setScale] = useState(1);
  const [variant, setVariant] = useState(0);
  const [stage, setStage] = useState<'plan' | 'early' | 'close'>('plan');
  const [decision, setDecision] = useState<SandboxDecision>('wait');
  const source = handbookSandboxCases[index];
  const run = sandboxRun(source, scale, variant, decision);

  function showSlice(label: string, slice: SandboxSlice) {
    const rows: [string, string][] = [
      ['Віртуальні витрати', money(slice.spend)], ['Первинні записи', String(slice.records)],
      ['Прийнято за умовами офера', String(slice.payable)], ['Нараховано', money(slice.accrual)],
      ['Результат після реклами', money(slice.contribution)], ['Каса після витрат', money(slice.cash)],
    ];
    return <View style={styles.panel}><Text style={styles.h2}>{label}</Text>{rows.map(([key, value]) => (
      <View key={key} style={styles.row}><Text style={styles.body}>{key}</Text><Text style={styles.value}>{value}</Text></View>
    ))}</View>;
  }
  function decide(value: SandboxDecision) { setDecision(value); setStage('close'); }

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: 18, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 24, gap: 12 }}>
      <Pressable accessibilityRole="button" onPress={() => router.dismissTo('/home')}><Text style={styles.link}>← Академія</Text></Pressable>
      <Text style={styles.h1}>Пісочниця</Text>
      {!started ? <>
        <Text style={styles.body}>Пісочниця відкривається після фіналу «Старту».</Text>
        <Button title="До Старту" onPress={() => router.replace('/branch/STA-A2')} />
      </> : <>
        <Text style={styles.body}>Навчальні дані й віртуальний бюджет. Суми показують грошовий еквівалент лише в межах обраного сценарію.</Text>
        {stage === 'plan' && <>
          <Text style={styles.h2}>Сценарій</Text>
          <View style={styles.choices}>{handbookSandboxCases.map((item, i) => (
            <Pressable key={item.id} accessibilityRole="button" accessibilityState={{ selected: index === i }} onPress={() => setIndex(i)} style={[styles.option, index === i && styles.active]}>
              <Text style={styles.body}>{item.title}</Text>
            </Pressable>
          ))}</View>
          <Text style={styles.h2}>Бюджет порівняно з прикладом</Text>
          <View style={styles.choices}>{[0.5, 1, 1.5].map((item) => (
            <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: scale === item }} onPress={() => setScale(item)} style={[styles.option, scale === item && styles.active]}>
              <Text style={styles.body}>{money(source.spend * item)}</Text>
            </Pressable>
          ))}</View>
          <Text style={styles.body}>Оплачувана дія · {source.action} · {money(source.payout)} за зарахування.</Text>
          <Button title="Перейти до раннього зрізу" onPress={() => setStage('early')} />
        </>}
        {stage === 'early' && <>
          <Text style={styles.h2}>{source.title}</Text>
          {showSlice('Ранній зріз', run.early)}
          <Text style={styles.body}>{source.observation}</Text>
          <Button title="Дочекатися зрілого зрізу" onPress={() => decide('wait')} />
          <Button title="Збільшити бюджет на 30%" ghost onPress={() => decide('scale')} />
          <Button title="Призупинити нові витрати" ghost onPress={() => decide('stop')} />
        </>}
        {stage === 'close' && <>
          {showSlice('Зрілий зріз початкової групи', run.mature)}
          <Text style={styles.body}>{decision === 'scale'
            ? `Додаткова група витратила ${money(run.scaleSpend)}. Її дані ще дозрівають. Каса з обома витратами · ${money(run.totalCash)}.`
            : decision === 'stop' ? 'Нові витрати призупинено. Уже отримані записи продовжують дозрівати.'
            : 'Зістав ранній і зрілий зрізи та звір строк виплати перед новим рішенням.'}</Text>
          <Text style={styles.body}>{source.nextStep}</Text>
          <Button title="Новий прогін" onPress={() => { setVariant((n) => n + 1); setStage('plan'); }} />
        </>}
      </>}
    </ScrollView>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg }, h1: { color: C.txt, fontSize: 26, fontWeight: '900' },
  h2: { color: C.txt, fontSize: 17, fontWeight: '800' }, body: { color: C.txt, fontSize: 14, lineHeight: 20 },
  link: { color: C.blueTxt, fontSize: 15, fontWeight: '800' }, value: { color: C.accentTxt, fontWeight: '900', marginLeft: 10 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, option: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 10, backgroundColor: C.panel },
  active: { borderColor: C.accent, backgroundColor: C.accentTint }, panel: { borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, gap: 9, backgroundColor: C.panel },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});

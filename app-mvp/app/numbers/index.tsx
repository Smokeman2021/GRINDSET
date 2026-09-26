import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GrindykSay } from '../../src/components/GrindykSay';
import { Button } from '../../src/components/Button';
import { breakEvenCpl, totalsOf } from '../../src/data/advice';
import { useStore } from '../../src/store';
import { C } from '../../src/theme';

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};
const money = (v: number) => (Number.isFinite(v) ? `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}` : '—');

export default function Numbers() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { campaigns, addCampaign } = useStore();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [payout, setPayout] = useState('12');
  const [approve, setApprove] = useState('40');

  const valid = name.trim().length > 0 && num(payout) > 0 && num(approve) > 0 && num(approve) <= 100;

  const create = () => {
    const id = addCampaign({ name: name.trim().slice(0, 40), payout: num(payout), approve: num(approve) / 100, remindTimes: [] });
    setAdding(false);
    setName('');
    router.push(`/numbers/${id}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.x}>←</Text>
        </Pressable>
        <Text style={styles.title}>Мої цифри</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <GrindykSay
          text="Записуй дані своїх кампаній, а я підкажу за правилами курсу й нагадаю зазирнути в кабінет."
          pose="laptop"
          height={110}
        />

        {campaigns.map((c) => {
          const t = totalsOf(c);
          const be = breakEvenCpl(c);
          const last3 = totalsOf(c, c.entries.slice(-3));
          return (
            <Pressable key={c.id} onPress={() => router.push(`/numbers/${c.id}`)} style={({ pressed }) => [styles.card, pressed && { transform: [{ translateY: 2 }] }]}>
              <View style={styles.row}>
                <Text style={styles.cName} numberOfLines={1}>
                  {c.name}
                </Text>
                <Text style={[styles.badge, c.status === 'active' ? { color: C.accent } : { color: C.muted }]}>{c.status === 'active' ? 'Активна' : 'Пауза'}</Text>
              </View>
              <Text style={styles.sub}>
                Днів записано: {c.entries.length} · Беззбитковий CPL {money(be)}
              </Text>
              <View style={styles.metrics}>
                <Metric k="Витрати" v={money(t.spend)} />
                <Metric k="Ліди" v={String(t.leads)} />
                <Metric k="CPL (3 дні)" v={money(last3.cpl)} tone={Number.isFinite(last3.cpl) ? (last3.cpl <= be ? 'good' : 'bad') : undefined} />
                <Metric k="Прибуток" v={money(t.profit)} tone={t.spend > 0 ? (t.profit >= 0 ? 'good' : 'bad') : undefined} />
              </View>
            </Pressable>
          );
        })}

        {campaigns.length === 0 && !adding && <Text style={styles.empty}>Ще нема кампаній. Додай першу.</Text>}

        {adding ? (
          <View style={styles.card}>
            <Text style={styles.cTitle}>Нова кампанія</Text>
            <Text style={styles.label}>Назва (наприклад, «Товарка PL, зв'язка 1»)</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Назва" placeholderTextColor={C.muted} maxLength={40} />
            <Text style={styles.label}>Виплата за апрувнутий лід, $</Text>
            <TextInput style={styles.input} value={payout} onChangeText={setPayout} keyboardType="decimal-pad" />
            <Text style={styles.label}>Апрув-рейт, %</Text>
            <TextInput style={styles.input} value={approve} onChangeText={setApprove} keyboardType="decimal-pad" />
            <View style={{ gap: 10, marginTop: 8 }}>
              <Button title="Створити" onPress={create} disabled={!valid} />
              <Button title="Скасувати" onPress={() => setAdding(false)} />
            </View>
          </View>
        ) : (
          <View style={{ marginTop: 14 }}>
            <Button title="+ Нова кампанія" onPress={() => setAdding(true)} />
          </View>
        )}

        <Text style={styles.foot}>
          Дані лишаються на твоєму пристрої. Підключення до Facebook напряму (через Meta API) заплановане, потребує схвалення Meta. Поради: практика курсу, а не гарантія.
        </Text>
      </ScrollView>
    </View>
  );
}

function Metric({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.mv, tone === 'good' && { color: C.accent }, tone === 'bad' && { color: C.red }]}>{v}</Text>
      <Text style={styles.mk}>{k}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  x: { color: C.txt, fontSize: 24, fontWeight: '800' },
  title: { color: C.txt, fontSize: 18, fontWeight: '900' },
  card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginTop: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cName: { color: C.txt, fontWeight: '900', fontSize: 16, flex: 1 },
  cTitle: { color: C.txt, fontWeight: '900', fontSize: 16, marginBottom: 8 },
  badge: { fontWeight: '800', fontSize: 12 },
  sub: { color: C.muted, fontSize: 12, marginTop: 4 },
  metrics: { flexDirection: 'row', marginTop: 10, gap: 6 },
  mv: { color: C.txt, fontWeight: '900', fontSize: 14 },
  mk: { color: C.muted, fontSize: 11, marginTop: 2 },
  empty: { color: C.muted, textAlign: 'center', marginTop: 20 },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  input: { backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: C.txt, fontSize: 16, fontWeight: '700' },
  foot: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20, lineHeight: 17 },
});

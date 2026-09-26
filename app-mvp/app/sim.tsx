import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';
import { Icon } from '../src/components/Icon';
import { breakEvenCpl, DAYS, judge, newCase, nextBudget, playDay, SimAction, SimCase, SimDay, Verdict } from '../src/data/sim';
import { useStore } from '../src/store';
import { C } from '../src/theme';

const money = (v: number) => `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}`;

const ACTIONS: { id: SimAction; label: string; hint: string }[] = [
  { id: 'keep', label: 'Тримати як є', hint: 'Не чіпати. Дати алгоритму час.' },
  { id: 'up20', label: 'Підняти бюджет на 20%', hint: 'Обережне масштабування.' },
  { id: 'up100', label: 'Подвоїти бюджет', hint: 'Ризиковано, окрім «наливного» товару.' },
  { id: 'down30', label: 'Зменшити бюджет на 30%', hint: 'Обмежити ризик, але не зупиняти.' },
  { id: 'pause', label: 'Вимкнути зв’язку', hint: 'Зупинити й підбити підсумок.' },
];

export default function Sim() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finishSim = useStore((s) => s.finishSim);
  const [c, setC] = useState<SimCase>(() => newCase());
  const [phase, setPhase] = useState<'intro' | 'day' | 'end'>('intro');
  const [days, setDays] = useState<SimDay[]>([]);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);

  const be = useMemo(() => breakEvenCpl(c), [c]);
  const cur = days[days.length - 1];
  const totalProfit = days.reduce((s, d) => s + d.profit, 0);

  const start = () => {
    setDays([playDay(c, 1, c.startBudget, [])]);
    setPhase('day');
  };

  const finish = (all: SimDay[]) => {
    const v = judge(c, all);
    setVerdict(v);
    setReward(finishSim(v.stars));
    setPhase('end');
  };

  const decide = (action: SimAction) => {
    const updated = days.map((d, i) => (i === days.length - 1 ? { ...d, action } : d));
    setDays(updated);
    if (action === 'pause' || updated.length >= DAYS) {
      finish(updated);
      return;
    }
    const budget = nextBudget(cur.budget, action);
    setDays([...updated, playDay(c, updated.length + 1, budget, updated)]);
  };

  const again = () => {
    setC(newCase());
    setDays([]);
    setVerdict(null);
    setReward(null);
    setPhase('intro');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.replace('/home')}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <Text style={styles.headTitle}>Симулятор кампанії</Text>
        <Text style={styles.headDay}>{phase === 'day' ? `День ${days.length}/${DAYS}` : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        {phase === 'intro' && (
          <>
            <GrindykSay text="Тримай зв'язку на 5 днів. Рішення твої, гроші вигадані, уроки справжні." pose="laptop" height={130} />
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Твоя зв'язка</Text>
              <Row k="Виплата за апрувнутий лід" v="$12" />
              <Row k="Апрув-рейт" v="40%" />
              <Row k="Беззбитковий CPL" v={money(be)} tone="gold" />
              <Row k="Стартовий бюджет" v={`${money(c.startBudget)} / день`} />
              <Text style={styles.small}>
                Справжню вартість ліда зв'язки ти не знаєш. Про неї говорять лише дані: пам'ятай, що перший день часто без лідів, а один день це шум.
              </Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Правила з курсу</Text>
              <Text style={styles.rule}>• Аналізуй у розрізі 2–3 днів, не одного.</Text>
              <Text style={styles.rule}>• Два дні поспіль без лідів: перевіряй, переробляй, вимикай.</Text>
              <Text style={styles.rule}>• Не чіпай те, що працює. Масштаб: 10–20% раз на 2 дні.</Text>
              <Text style={styles.rule}>• Не давай адсету відкрутити повний бюджет без лідів.</Text>
              <Text style={styles.small}>Це практика автора курсу, а не офіційна документація Meta.</Text>
            </View>
            <Button title="Запустити рекламу" onPress={start} />
          </>
        )}

        {phase === 'day' && cur && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Результат дня {cur.day}</Text>
              <Row k="Витрати" v={money(cur.spend)} />
              <Row k="Ліди" v={String(cur.leads)} />
              <Row k="CPL" v={cur.cpl === null ? '—' : money(cur.cpl)} tone={cur.cpl !== null && cur.cpl > be ? 'bad' : cur.cpl !== null ? 'good' : undefined} />
              <Row k="Прибуток дня" v={money(cur.profit)} tone={cur.profit >= 0 ? 'good' : 'bad'} />
              <Row k="Прибуток за весь час" v={money(totalProfit)} tone={totalProfit >= 0 ? 'good' : 'bad'} />
            </View>

            {cur.day === 1 && cur.leads === 0 && <Text style={styles.tip}>Перший день без лідів: алгоритм ще пристрілюється. Не панікуй.</Text>}

            {days.length > 1 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Історія</Text>
                {days.slice(0, -1).map((d) => (
                  <Text key={d.day} style={styles.rule}>
                    День {d.day}: {money(d.spend)} → {d.leads} лідів ({money(d.profit)}) · {ACTIONS.find((a) => a.id === d.action)?.label}
                  </Text>
                ))}
              </View>
            )}

            <Text style={styles.decide}>{cur.day >= DAYS ? 'Фінал. Підбий підсумок' : 'Що робиш?'}</Text>
            {cur.day >= DAYS ? (
              <Button title="Підбити підсумок" onPress={() => decide('keep')} />
            ) : (
              ACTIONS.map((a) => (
                <Pressable key={a.id} onPress={() => decide(a.id)} style={({ pressed }) => [styles.action, pressed && { transform: [{ translateY: 2 }] }]}>
                  <Text style={styles.actionLabel}>{a.label}</Text>
                  <Text style={styles.actionHint}>{a.hint}</Text>
                </Pressable>
              ))
            )}
          </>
        )}

        {phase === 'end' && verdict && (
          <>
            <GrindykSay
              text={verdict.stars >= 2 ? 'Гарне рішення. Ось як це виглядало збоку.' : 'Злив — це теж досвід. Дивись, що можна було зробити.'}
              pose={verdict.stars >= 2 ? 'cheer' : 'think'}
              height={120}
            />
            <Text style={styles.stars}>{'★'.repeat(verdict.stars)}{'☆'.repeat(3 - verdict.stars)}</Text>
            <Text style={styles.verdict}>{verdict.title}</Text>
            <Text style={[styles.profit, { color: verdict.profit >= 0 ? C.accent : C.red }]}>
              {money(verdict.profit)} із {money(verdict.spend)} витрат
            </Text>
            <View style={styles.card}>
              {verdict.lines.map((l, i) => (
                <Text key={i} style={styles.rule}>
                  {l}
                </Text>
              ))}
            </View>
            {reward && (
              <View style={styles.rewardRow}>
                <View style={styles.rewardItem}>
                  <Icon name="coin" size={28} />
                  <Text style={styles.reward}>+{reward.coins}</Text>
                </View>
                <View style={styles.rewardItem}>
                  <Icon name="xp" size={28} />
                  <Text style={[styles.reward, { color: C.blue }]}>+{reward.xp} XP</Text>
                </View>
              </View>
            )}
            <View style={{ gap: 10, marginTop: 8 }}>
              <Button title="Ще одна зв'язка" onPress={again} />
              <Button title="На головну" onPress={() => router.replace('/home')} />
            </View>
            <Text style={styles.small}>Повна нагорода один раз на день, далі 30%.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ k, v, tone }: { k: string; v: string; tone?: 'good' | 'bad' | 'gold' }) {
  return (
    <View style={styles.row}>
      <Text style={styles.k}>{k}</Text>
      <Text style={[styles.v, tone === 'good' && { color: C.accent }, tone === 'bad' && { color: C.red }, tone === 'gold' && { color: C.gold }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  x: { color: C.muted, fontSize: 22, fontWeight: '700' },
  headTitle: { color: C.txt, fontWeight: '900', fontSize: 16, flex: 1 },
  headDay: { color: C.gold, fontWeight: '800' },
  card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  cardTitle: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line },
  k: { color: C.txt, fontSize: 14, flex: 1 },
  v: { color: C.txt, fontWeight: '900', fontSize: 15 },
  small: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  rule: { color: C.txt, fontSize: 14, lineHeight: 21, marginBottom: 4 },
  tip: { color: C.gold, fontWeight: '700', marginBottom: 12, textAlign: 'center' },
  decide: { color: C.txt, fontWeight: '900', fontSize: 18, marginVertical: 10 },
  action: { backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  actionLabel: { color: C.txt, fontWeight: '800', fontSize: 15 },
  actionHint: { color: C.muted, fontSize: 12, marginTop: 2 },
  stars: { color: C.gold, fontSize: 40, textAlign: 'center', marginTop: 4 },
  verdict: { color: C.txt, fontWeight: '900', fontSize: 24, textAlign: 'center' },
  profit: { fontWeight: '800', fontSize: 16, textAlign: 'center', marginVertical: 8 },
  rewardRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 4 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reward: { color: C.gold, fontWeight: '900', fontSize: 22 },
});

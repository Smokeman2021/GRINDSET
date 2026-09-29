import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';
import { Reaction } from '../src/components/Reaction';
import { Icon } from '../src/components/Icon';
import { ADS_SIM_STEPS } from '../src/data/adsSim';
import { useStore } from '../src/store';
import { Theme, useStyles, useTheme } from '../src/theme';

// Фіксована палітра «як у справжньому кабінеті» — не залежить від Ночі/Дня застосунку,
// бо мета — впізнати реальний Ads Manager, а не наш дизайн.
const META = {
  bg: '#ffffff',
  panel: '#f5f6f7',
  border: '#cbd2d9',
  text: '#1c2b33',
  muted: '#65676b',
  blue: '#0866ff',
  blueBg: '#e7f1ff',
  green: '#149a53',
  greenBg: '#e5f5eb',
  red: '#d63031',
  redBg: '#fdeaea',
};

export default function AdsSim() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const finishAdsSim = useStore((s) => s.finishAdsSim);
  const [phase, setPhase] = useState<'intro' | 'play' | 'end'>('intro');
  const [stepIdx, setStepIdx] = useState(0);
  const [picked, setPicked] = useState<string | null>(null);
  const [wrongIds, setWrongIds] = useState<string[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [reward, setReward] = useState<{ coins: number; xp: number } | null>(null);

  const step = ADS_SIM_STEPS[stepIdx];
  const chosen = step?.options.find((o) => o.id === picked);
  const isLast = stepIdx === ADS_SIM_STEPS.length - 1;

  const start = () => {
    setStepIdx(0);
    setPicked(null);
    setWrongIds([]);
    setMistakes(0);
    setPhase('play');
  };

  const tap = (optId: string) => {
    if (picked) return; // вже відповіли на цей крок, чекаємо «Далі»
    const opt = step.options.find((o) => o.id === optId)!;
    setPicked(optId);
    if (!opt.correct) {
      setWrongIds((w) => [...w, optId]);
      setMistakes((m) => m + 1);
    }
  };

  const next = () => {
    if (!chosen?.correct) {
      // невірний вибір — дозволяємо спробувати ще раз на цьому ж кроці
      setPicked(null);
      return;
    }
    if (isLast) {
      const stars = mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
      setReward(finishAdsSim(stars));
      setPhase('end');
      return;
    }
    setStepIdx((i) => i + 1);
    setPicked(null);
  };

  const again = () => {
    setReward(null);
    setPhase('intro');
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.replace('/library')}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <Text style={styles.headTitle}>Тренажер кабінету</Text>
        <Text style={styles.headStep}>{phase === 'play' ? `${stepIdx + 1}/${ADS_SIM_STEPS.length}` : ''}</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        {phase === 'intro' && (
          <>
            <GrindykSay text="Спробуємо настройку кампанії — так само, як у справжньому Ads Manager. 5 рішень, кожне впливає на результат." pose="laptop" height={130} />
            <View style={styles.introCard}>
              <Text style={styles.introTitle}>Як це працює</Text>
              <Text style={styles.introLine}>• Екрани виглядають так само, як реальний кабінет Facebook.</Text>
              <Text style={styles.introLine}>• На кожному кроці — одне рішення з курсу.</Text>
              <Text style={styles.introLine}>• Помилився — поясню чому, спробуєш ще раз.</Text>
              <Text style={styles.introLine}>• У кінці — зведення і нагорода.</Text>
            </View>
            <Button title="Почати налаштування" onPress={start} />
          </>
        )}

        {phase === 'play' && step && (
          <>
            <GrindykSay text={step.talk} pose="think" height={100} />
            <Text style={styles.task}>{step.task}</Text>

            {/* мок-екран кабінету */}
            <View style={styles.device}>
              <View style={styles.deviceTop}>
                <Text style={styles.deviceTitle}>{step.screenTitle}</Text>
                <View style={styles.deviceDots}>
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                  <View style={styles.dot} />
                </View>
              </View>

              {step.kind === 'empty' && (
                <View style={styles.emptyState}>
                  <Text style={{ fontSize: 30 }}>🔍</Text>
                  <Text style={styles.emptyTitle}>Виконайте налаштування для показу реклами</Text>
                </View>
              )}

              <View style={step.kind === 'grid' ? styles.grid : styles.list}>
                {step.options.map((o) => {
                  const isPicked = picked === o.id;
                  const isWrongPick = isPicked && !o.correct;
                  const isRightPick = isPicked && o.correct;
                  const wasWrongBefore = wrongIds.includes(o.id) && !isPicked;
                  return (
                    <Pressable
                      key={o.id}
                      disabled={!!picked}
                      onPress={() => tap(o.id)}
                      style={[
                        step.kind === 'grid' ? styles.gridItem : styles.listItem,
                        isRightPick && styles.optOk,
                        isWrongPick && styles.optBad,
                        wasWrongBefore && styles.optDimmed,
                      ]}
                    >
                      <Text style={[styles.optLabel, isRightPick && { color: META.green }, isWrongPick && { color: META.red }]}>{o.label}</Text>
                      {o.sub && <Text style={styles.optSub}>{o.sub}</Text>}
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {picked && (
              <View style={[styles.feedback, chosen?.correct ? styles.feedbackOk : styles.feedbackBad]}>
                <Reaction kind={chosen?.correct ? 'good' : 'bad'} size={40} />
                <Text style={styles.feedbackTxt}>{chosen?.feedback}</Text>
              </View>
            )}

            <View style={{ marginTop: 14 }}>
              <Button title={picked ? (chosen?.correct ? (isLast ? 'Опублікувати' : 'Далі') : 'Спробувати ще раз') : 'Обери варіант вище'} onPress={next} disabled={!picked} />
            </View>
          </>
        )}

        {phase === 'end' && (
          <>
            <GrindykSay text={mistakes === 0 ? 'Чисто, без жодної помилки. Кабінет для тебе вже не чорна скринька.' : 'Опубліковано. Не з першого разу, зате запам\'ятається.'} pose="cheer" height={120} />
            <Text style={styles.stars}>{'★'.repeat(mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1)}{'☆'.repeat(3 - (mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1))}</Text>
            <Text style={styles.verdict}>Кампанія опублікована</Text>
            <Text style={styles.verdictSub}>Помилок: {mistakes}</Text>
            {reward && (
              <View style={styles.rewardRow}>
                <View style={styles.rewardItem}>
                  <Icon name="coin" size={28} />
                  <Text style={styles.reward}>+{reward.coins}</Text>
                </View>
                <View style={styles.rewardItem}>
                  <Icon name="xp" size={28} />
                  <Text style={[styles.reward, { color: C.blueTxt }]}>+{reward.xp} XP</Text>
                </View>
              </View>
            )}
            <View style={{ gap: 10, marginTop: 12 }}>
              <Button title="Ще раз" onPress={again} />
              <Button title="До бібліотеки" onPress={() => router.replace('/library')} />
            </View>
            <Text style={styles.small}>Повна нагорода один раз на день, далі 30%.</Text>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  x: { color: C.muted, fontSize: 22, fontWeight: '700' },
  headTitle: { color: C.txt, fontWeight: '900', fontSize: 16, flex: 1 },
  headStep: { color: C.goldTxt, fontWeight: '800' },
  introCard: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginVertical: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  introTitle: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  introLine: { color: C.txt, fontSize: 14, lineHeight: 21, marginBottom: 2 },
  task: { color: C.txt, fontWeight: '800', fontSize: 16, marginTop: 12, marginBottom: 10 },
  device: { backgroundColor: META.bg, borderRadius: 16, overflow: 'hidden', borderWidth: 2, borderColor: META.border },
  deviceTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: META.border, backgroundColor: META.panel },
  deviceTitle: { color: META.text, fontWeight: '800', fontSize: 14 },
  deviceDots: { flexDirection: 'row', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: META.border },
  emptyState: { alignItems: 'center', paddingVertical: 30, paddingHorizontal: 20, gap: 10 },
  emptyTitle: { color: META.text, fontWeight: '700', fontSize: 13, textAlign: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, padding: 14 },
  gridItem: { width: '47%', flexGrow: 1, backgroundColor: META.bg, borderRadius: 10, borderWidth: 2, borderColor: META.border, padding: 12, alignItems: 'center' },
  list: { padding: 14, gap: 10 },
  listItem: { backgroundColor: META.bg, borderRadius: 10, borderWidth: 2, borderColor: META.border, padding: 13 },
  optOk: { borderColor: META.green, backgroundColor: META.greenBg },
  optBad: { borderColor: META.red, backgroundColor: META.redBg },
  optDimmed: { opacity: 0.4 },
  optLabel: { color: META.text, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  optSub: { color: META.muted, fontSize: 11, marginTop: 3, textAlign: 'center' },
  feedback: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 12, marginTop: 14, borderWidth: 2 },
  feedbackOk: { backgroundColor: C.accentTint, borderColor: C.accent },
  feedbackBad: { backgroundColor: C.redTint, borderColor: C.red },
  feedbackTxt: { color: C.txt, fontSize: 13, lineHeight: 19, flex: 1 },
  stars: { color: C.goldTxt, fontSize: 40, textAlign: 'center', marginTop: 4 },
  verdict: { color: C.txt, fontWeight: '900', fontSize: 22, textAlign: 'center' },
  verdictSub: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
  rewardRow: { flexDirection: 'row', justifyContent: 'center', gap: 24, marginTop: 12 },
  rewardItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reward: { color: C.goldTxt, fontWeight: '900', fontSize: 22 },
  small: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 10 },
});

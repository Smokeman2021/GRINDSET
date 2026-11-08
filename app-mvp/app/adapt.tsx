import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADAPT_STEPS, SKILL_LEVELS } from '../src/data/quiz';
import { useStore } from '../src/store';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';
import { poseFor } from '../src/data/phrases';
import { Theme, useStyles, useTheme } from '../src/theme';

// «Підлаштувати курс»: решта питань опитування, які не заважали стартувати. Пропонується після першого уроку.
// Проста версія: відповіді лягають у quiz, з них складається маршрут (/plan). Повну логіку адаптації автор дасть окремо.
export default function Adapt() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setQuizAnswer = useStore((s) => s.setQuizAnswer);
  const finishAdapt = useStore((s) => s.finishAdapt);

  const pose = useMemo(() => poseFor('theory'), []);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [skillAns, setSkillAns] = useState<Record<string, number>>({});

  const step = ADAPT_STEPS[idx];
  const skillsDone = step.kind === 'skills' && step.skills.every((s) => skillAns[s.key] !== undefined);
  const last = idx + 1 >= ADAPT_STEPS.length;

  const next = () => {
    setSelected(null);
    if (last) {
      finishAdapt();
      router.replace('/plan');
    } else {
      setIdx(idx + 1);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}>
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Text style={styles.x}>✕</Text>
        </Pressable>
        <View style={styles.segs}>
          {ADAPT_STEPS.map((_, i) => (
            <View key={i} style={[styles.seg, i <= idx && styles.segOn]} />
          ))}
        </View>
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
        {idx === 0 && (
          <GrindykSay text="Кілька питань, щоб я підлаштував маршрут. Можна кинути будь-коли, курс від цього не зламається." pose={pose} height={110} />
        )}
        <Text style={styles.h2}>{step.q}</Text>
        {step.hint && <Text style={styles.hint}>{step.hint}</Text>}
        {step.kind === 'choice' &&
          step.options.map((o, i) => (
            <Pressable key={i} style={[styles.opt, selected === i && styles.optSel, o.soon && styles.optSoon]} onPress={() => setSelected(i)}>
              <Text style={styles.optEmoji}>{o.emoji}</Text>
              <Text style={styles.optTxt}>{o.text}</Text>
              {o.soon && <Text style={styles.soon}>скоро</Text>}
            </Pressable>
          ))}
        {step.kind === 'skills' &&
          step.skills.map((sk) => (
            <View key={sk.key} style={styles.skill}>
              <Text style={styles.skillLabel}>{sk.label}</Text>
              <View style={styles.chips}>
                {SKILL_LEVELS.map((lv, li) => (
                  <Pressable key={lv} onPress={() => setSkillAns((p) => ({ ...p, [sk.key]: li }))} style={[styles.chip, skillAns[sk.key] === li && styles.chipOn]}>
                    <Text style={[styles.chipTxt, skillAns[sk.key] === li && { color: C.onAccent }]}>{lv}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}
      </ScrollView>
      <Button
        title={last ? 'Показати маршрут' : 'Далі'}
        disabled={step.kind === 'choice' ? selected === null : !skillsDone}
        onPress={() => {
          if (step.kind === 'choice') {
            if (selected === null) return;
            setQuizAnswer(step.key, step.options[selected].text);
          } else {
            step.skills.forEach((sk) => setQuizAnswer(sk.key, SKILL_LEVELS[skillAns[sk.key]]));
          }
          next();
        }}
      />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
    top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    x: { color: C.muted, fontSize: 22 },
    segs: { flex: 1, flexDirection: 'row', gap: 4 },
    seg: { flex: 1, height: 6, borderRadius: 4, backgroundColor: C.line },
    segOn: { backgroundColor: C.accent },
    h2: { color: C.txt, fontSize: 21, fontWeight: '700', marginBottom: 14, marginTop: 10 },
    hint: { color: C.muted, fontSize: 13, marginTop: -8, marginBottom: 14 },
    opt: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.panel, borderColor: C.line, borderWidth: 2, borderRadius: 16, padding: 15, marginBottom: 12, borderBottomWidth: 5 },
    optSel: { borderColor: C.accent, backgroundColor: C.accentTint, borderBottomColor: C.accentEdge },
    optSoon: { opacity: 0.55 },
    soon: { color: C.goldTxt, fontSize: 11, fontWeight: '800' },
    optEmoji: { fontSize: 24 },
    optTxt: { color: C.txt, fontSize: 16, flex: 1 },
    skill: { marginBottom: 14 },
    skillLabel: { color: C.txt, fontWeight: '800', fontSize: 15, marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel },
    chipOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    chipTxt: { color: C.txt, fontWeight: '700', fontSize: 12 },
  });

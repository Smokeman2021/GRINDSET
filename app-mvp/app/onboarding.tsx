import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { QUIZ } from '../src/data/quiz';
import { DailyGoal, GOAL_LABEL, GOAL_XP, useStore } from '../src/store';
import { Button } from '../src/components/Button';
import { C } from '../src/theme';

type Phase = 'welcome' | 'quiz' | 'goal' | 'name';

const FULL = require('../assets/grindyk-full.png');
const BUST = require('../assets/grindyk-bust.png');

const GOALS: { key: DailyGoal; emoji: string; desc: string }[] = [
  { key: 'casual', emoji: '🌱', desc: '1 урок на день' },
  { key: 'regular', emoji: '⚡', desc: '2 уроки на день' },
  { key: 'intense', emoji: '🔥', desc: '3+ уроки на день' },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setQuizAnswer = useStore((s) => s.setQuizAnswer);
  const finishOnboarding = useStore((s) => s.finishOnboarding);

  const [phase, setPhase] = useState<Phase>('welcome');
  const [stepIdx, setStepIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [goal, setGoal] = useState<DailyGoal | null>(null);
  const [name, setName] = useState('');

  const pad = { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 };

  if (phase === 'welcome') {
    return (
      <View style={[styles.screen, styles.center, pad]}>
        <Image source={FULL} style={styles.heroImg} resizeMode="contain" />
        <Text style={styles.h1}>GRINDSET</Text>
        <Text style={styles.muted}>Performance-маркетинг. Без води.</Text>
        <View style={styles.bubble}>
          <Text style={styles.bubbleTxt}>
            Йо. Я Гріндік. Зараз швидко налаштуємо все під тебе.
          </Text>
        </View>
        <Text style={styles.disclaimer}>
          Навчальний контент. Не фінансова порада і не гарантія доходу.
        </Text>
        <Button title="Погнали" onPress={() => setPhase('quiz')} />
      </View>
    );
  }

  if (phase === 'goal') {
    return (
      <View style={[styles.screen, pad]}>
        <View style={{ alignItems: 'center', marginBottom: 10 }}>
          <View style={styles.avatarSm}>
            <Image source={BUST} style={styles.avatarImg} />
          </View>
        </View>
        <Text style={styles.h2}>Яка ціль на день?</Text>
        {GOALS.map((g) => (
          <Pressable
            key={g.key}
            style={[styles.opt, goal === g.key && styles.optSel]}
            onPress={() => setGoal(g.key)}
          >
            <Text style={styles.optEmoji}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.optTitle}>
                {GOAL_LABEL[g.key]} · {GOAL_XP[g.key]} XP
              </Text>
              <Text style={styles.optDesc}>{g.desc}</Text>
            </View>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Button title="Далі" disabled={goal === null} onPress={() => setPhase('name')} />
      </View>
    );
  }

  if (phase === 'name') {
    return (
      <View style={[styles.screen, styles.center, pad]}>
        <View style={styles.avatarLg}>
          <Image source={BUST} style={styles.avatarImg} />
        </View>
        <Text style={styles.h2}>А тебе як звати?</Text>
        <Text style={styles.muted}>Ім'я або нік — так тебе бачитимуть у застосунку.</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          maxLength={14}
          placeholder="Твій нік"
          placeholderTextColor={C.muted}
        />
        <Button
          title="Готово"
          disabled={name.trim().length === 0}
          onPress={() => {
            finishOnboarding(name, goal ?? 'regular');
            router.replace('/diagnostic');
          }}
        />
      </View>
    );
  }

  // quiz
  const step = QUIZ[stepIdx];
  return (
    <View style={[styles.screen, pad]}>
      <View style={styles.segs}>
        {QUIZ.map((_, i) => (
          <View key={i} style={[styles.seg, i <= stepIdx && styles.segOn]} />
        ))}
      </View>
      <ScrollView contentContainerStyle={{ paddingTop: 16 }}>
        <Text style={styles.h2}>{step.q}</Text>
        {step.options.map((o, i) => (
          <Pressable
            key={i}
            style={[styles.opt, selected === i && styles.optSel]}
            onPress={() => setSelected(i)}
          >
            <Text style={styles.optEmoji}>{o.emoji}</Text>
            <Text style={styles.optTxt}>{o.text}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <Button
        title="Далі"
        disabled={selected === null}
        onPress={() => {
          if (selected === null) return;
          setQuizAnswer(step.key, step.options[selected].text);
          setSelected(null);
          if (stepIdx + 1 >= QUIZ.length) setPhase('goal');
          else setStepIdx(stepIdx + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22 },
  center: { justifyContent: 'center', alignItems: 'center' },
  heroImg: { width: 170, height: 340 },
  avatarSm: {
    width: 76,
    height: 76,
    borderRadius: 38,
    overflow: 'hidden',
    backgroundColor: C.imgBg,
    borderWidth: 3,
    borderColor: C.accent,
    borderBottomWidth: 5,
    borderBottomColor: C.accentEdge,
  },
  avatarLg: {
    width: 110,
    height: 110,
    borderRadius: 55,
    overflow: 'hidden',
    backgroundColor: C.imgBg,
    borderWidth: 3,
    borderColor: C.accent,
    borderBottomWidth: 6,
    borderBottomColor: C.accentEdge,
  },
  avatarImg: { width: '100%', height: '100%' },
  h1: { color: C.txt, fontSize: 28, fontWeight: '800', marginTop: 16 },
  h2: { color: C.txt, fontSize: 21, fontWeight: '700', marginBottom: 14 },
  muted: { color: C.muted, fontSize: 14, marginTop: 6, textAlign: 'center' },
  bubble: {
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 18,
    padding: 16,
    marginTop: 24,
    width: '100%',
    borderBottomWidth: 5,
  },
  bubbleTxt: { color: C.txt, fontSize: 16, lineHeight: 22 },
  disclaimer: { color: C.muted, fontSize: 12, textAlign: 'center', marginVertical: 18 },
  segs: { flexDirection: 'row', gap: 6, marginTop: 8 },
  seg: { flex: 1, height: 6, borderRadius: 4, backgroundColor: C.line },
  segOn: { backgroundColor: C.accent },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderBottomWidth: 5,
  },
  optSel: {
    borderColor: C.accent,
    backgroundColor: 'rgba(54,226,122,0.08)',
    borderBottomColor: C.accentEdge,
  },
  optEmoji: { fontSize: 24 },
  optTxt: { color: C.txt, fontSize: 16, flex: 1 },
  // без flex: 1, інакше в колонці на телефоні текст стискається до нуля висоти й обрізається
  optTitle: { color: C.txt, fontSize: 16, fontWeight: '700' },
  optDesc: { color: C.muted, fontSize: 13, marginTop: 2 },
  input: {
    width: '100%',
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 14,
    padding: 15,
    color: C.txt,
    fontSize: 18,
    textAlign: 'center',
    fontWeight: '700',
    marginVertical: 16,
  },
});

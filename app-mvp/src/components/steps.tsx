import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { allPaired, assignPair, matchOk, pairNoOfRight, unpairRight, type Assign } from '../data/matchRules';
import { NUM_KEYBOARD, NUM_PLACEHOLDER, parseNum, toggleSign } from '../data/numInput';
import type { Question } from '../data/lessons';

// null = ще не відповіли; { correct } = відповіли (або вичерпано час: тоді показуємо розв’язок)
export type Resolution = { correct: boolean } | null;

type Props<T extends Question['type']> = {
  step: Extract<Question, { type: T }>;
  resolution: Resolution;
  onResolve: (correct: boolean) => void;
};

function shuffled<T>(arr: T[], avoid?: (a: T[]) => boolean): T[] {
  let out = arr;
  for (let tries = 0; tries < 8; tries++) {
    out = [...arr];
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (!avoid || !avoid(out)) break;
  }
  return out;
}

// ─── Кілька правильних відповідей ───
export function MultiStep({ step, resolution, onResolve }: Props<'multi'>) {
  const styles = useStyles(makeStyles);
  const [sel, setSel] = useState<number[]>([]);
  const done = resolution !== null;
  const toggle = (i: number) => {
    if (done) return;
    setSel((s) => (s.includes(i) ? s.filter((x) => x !== i) : [...s, i]));
  };
  const check = () => {
    const ok = sel.length === step.answers.length && step.answers.every((a) => sel.includes(a));
    onResolve(ok);
  };
  return (
    <View>
      <Text style={styles.hint}>Обери всі правильні варіанти</Text>
      {step.options.map((o, i) => {
        const isRight = step.answers.includes(i);
        const isSel = sel.includes(i);
        return (
          <Pressable
            key={i}
            disabled={done}
            onPress={() => toggle(i)}
            style={({ pressed }) => [
              styles.opt,
              !done && isSel && styles.optSel,
              done && isRight && styles.optOk,
              done && isSel && !isRight && styles.optNo,
              pressed && !done && styles.optPressed,
            ]}
          >
            <Text style={styles.box}>{done ? (isRight ? '✓' : isSel ? '✕' : '') : isSel ? '■' : '□'}</Text>
            <Text style={styles.optTxt}>{o}</Text>
          </Pressable>
        );
      })}
      {!done && <Button title="Перевірити" disabled={sel.length === 0} onPress={check} />}
    </View>
  );
}

// ─── Збери зв'язку: по одному варіанту на кожен слот ───
export function BundleStep({ step, resolution, onResolve, hint }: Props<'bundle'> & { hint?: string }) {
  const styles = useStyles(makeStyles);
  const [sel, setSel] = useState<(number | null)[]>(() => step.slots.map(() => null));
  const done = resolution !== null;
  const all = sel.every((v) => v !== null);
  const check = () => onResolve(step.slots.every((s, i) => sel[i] === s.answer));
  return (
    <View>
      <Text style={styles.hint}>{hint ?? "Збери зв'язку: обери по одному варіанту в кожному пункті"}</Text>
      {step.slots.map((slot, si) => (
        <View key={si} style={{ marginBottom: 12 }}>
          <Text style={styles.slotLabel}>{slot.label}</Text>
          {slot.options.map((o, oi) => {
            const isSel = sel[si] === oi;
            const right = slot.answer === oi;
            return (
              <Pressable
                key={oi}
                disabled={done}
                onPress={() => setSel((p) => p.map((v, i) => (i === si ? oi : v)))}
                style={({ pressed }) => [
                  styles.opt,
                  !done && isSel && styles.optSel,
                  done && right && styles.optOk,
                  done && isSel && !right && styles.optNo,
                  pressed && !done && styles.optPressed,
                ]}
              >
                <Text style={styles.box}>{done ? (right ? '✓' : isSel ? '✕' : '') : isSel ? '●' : '○'}</Text>
                <Text style={styles.optTxt}>{o}</Text>
              </Pressable>
            );
          })}
        </View>
      ))}
      {!done && <Button title="Перевірити" disabled={!all} onPress={check} />}
    </View>
  );
}

// ─── Історія-кейс: послідовні рішення ───
export function StoryStep({ step, resolution, onResolve }: Props<'story'>) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [scene, setScene] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [goods, setGoods] = useState(0);
  const done = resolution !== null;
  const cur = step.scenes[Math.min(scene, step.scenes.length - 1)];
  const choose = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (cur.options[i].good) setGoods((g) => g + 1);
  };
  const advance = () => {
    if (scene + 1 >= step.scenes.length) {
      onResolve(goods / step.scenes.length >= (step.passRatio ?? 0.7));
    } else {
      setScene(scene + 1);
      setPicked(null);
    }
  };
  if (done) {
    return (
      <View style={styles.storyBox}>
        <Text style={styles.hint}>
          Вдалих рішень: {goods} з {step.scenes.length}
        </Text>
      </View>
    );
  }
  return (
    <View>
      {scene === 0 && picked === null && <Text style={styles.storyIntro}>{step.intro}</Text>}
      <Text style={styles.hint}>
        Крок {scene + 1} з {step.scenes.length}
      </Text>
      <View style={styles.storyBox}>
        <Text style={styles.storyTxt}>{cur.text}</Text>
      </View>
      {cur.options.map((o, i) => (
        <Pressable
          key={i}
          disabled={picked !== null}
          onPress={() => choose(i)}
          style={({ pressed }) => [
            styles.opt,
            picked === i && (o.good ? styles.optOk : styles.optNo),
            picked !== null && picked !== i && o.good && styles.optOk,
            pressed && picked === null && styles.optPressed,
          ]}
        >
          <Text style={styles.optTxt}>{o.label}</Text>
        </Pressable>
      ))}
      {picked !== null && (
        <View style={{ marginTop: 8 }}>
          <Text style={[styles.storyFb, { color: cur.options[picked].good ? C.accent : C.red }]}>{cur.options[picked].feedback}</Text>
          <Button title={scene + 1 >= step.scenes.length ? 'Підсумок' : 'Далі'} onPress={advance} />
        </View>
      )}
    </View>
  );
}

// ─── Послідовність ───
export function OrderStep({ step, resolution, onResolve }: Props<'order'>) {
  const styles = useStyles(makeStyles);
  const pool = useMemo(
    () => shuffled(step.items.map((_, i) => i), (a) => a.every((v, i) => v === i)),
    [step]
  );
  const [picked, setPicked] = useState<number[]>([]); // індекси в step.items (правильний порядок = 0..n-1)
  const done = resolution !== null;
  const rest = pool.filter((i) => !picked.includes(i));
  const check = () => onResolve(picked.every((v, i) => v === i));

  if (done) {
    return (
      <View>
        <Text style={styles.hint}>Правильний порядок</Text>
        {step.items.map((it, i) => {
          const userOk = picked[i] === i;
          return (
            <View key={i} style={[styles.opt, styles.optOk]}>
              <Text style={styles.num}>{i + 1}</Text>
              <Text style={styles.optTxt}>{it}</Text>
              {picked.length === step.items.length && !userOk && <Text style={styles.wrong}>✕</Text>}
            </View>
          );
        })}
      </View>
    );
  }
  return (
    <View>
      <Text style={styles.hint}>Торкайся елементів по черзі, щоб скласти правильний порядок</Text>
      {picked.map((idx, pos) => (
        <Pressable key={idx} onPress={() => setPicked((p) => p.filter((x) => x !== idx))} style={[styles.opt, styles.optSel]}>
          <Text style={styles.num}>{pos + 1}</Text>
          <Text style={styles.optTxt}>{step.items[idx]}</Text>
        </Pressable>
      ))}
      {rest.length > 0 && <Text style={[styles.hint, { marginTop: 6 }]}>Доступні елементи</Text>}
      {rest.map((idx) => (
        <Pressable
          key={idx}
          onPress={() => setPicked((p) => [...p, idx])}
          style={({ pressed }) => [styles.opt, pressed && styles.optPressed]}
        >
          <Text style={styles.optTxt}>{step.items[idx]}</Text>
        </Pressable>
      ))}
      <Button title="Перевірити" disabled={picked.length !== step.items.length} onPress={check} />
    </View>
  );
}

// ─── З’єднати пари ───
// Пари у дві колонки (ТЗ 006, 3.4): ліва колонка в порядку завдання, права — перемішана. Торкнись елемента зліва, потім пари справа.
// Обидві картки пари отримують однаковий номер; повторний дотик до правої картки знімає пару. Довгі назви переносяться всередині карток.
export function MatchStep({ step, resolution, onResolve }: Props<'match'>) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const rights = useMemo(
    () => shuffled(step.pairs.map((p) => p[1]), (a) => a.every((v, i) => v === step.pairs[i][1])),
    [step]
  );
  const [assign, setAssign] = useState<Assign>({}); // ліва позиція -> індекс у rights
  const [active, setActive] = useState<number | null>(null);
  const done = resolution !== null;

  const pickRight = (ri: number) => {
    if (done) return;
    if (active === null) {
      setAssign((a) => unpairRight(a, ri));
      return;
    }
    setAssign((a) => assignPair(a, active, ri));
    setActive(null);
  };
  const check = () => onResolve(matchOk(step.pairs, rights, assign));

  return (
    <View>
      <Text style={styles.hint}>{active === null ? 'Торкнись елемента зліва, потім його пари справа' : 'Тепер обери пару справа'}</Text>
      <View style={styles.matchCols}>
        <View style={styles.matchCol}>
          {step.pairs.map((p, li) => {
            const ri = assign[li];
            const chosen = ri !== undefined ? rights[ri] : null;
            const ok = done && chosen === p[1];
            const bad = done && chosen !== p[1];
            return (
              <Pressable
                key={li}
                disabled={done}
                onPress={() => setActive((a) => (a === li ? null : li))}
                accessibilityRole="button"
                accessibilityLabel={`${p[0]}${chosen ? `, пара: ${chosen}` : ''}`}
                style={({ pressed }) => [styles.matchItem, active === li && styles.optSel, ok && styles.optOk, bad && styles.optNo, pressed && !done && styles.optPressed]}
              >
                {ri !== undefined && <Text style={styles.pairNo}>{li + 1}</Text>}
                <Text style={styles.matchTxt}>{p[0]}</Text>
                {bad && <Text style={styles.matchFix}>✓ {p[1]}</Text>}
              </Pressable>
            );
          })}
        </View>
        <View style={styles.matchCol}>
          {rights.map((r, ri) => {
            const no = pairNoOfRight(assign, ri);
            return (
              <Pressable
                key={ri}
                disabled={done}
                onPress={() => pickRight(ri)}
                accessibilityRole="button"
                accessibilityLabel={`${r}${no ? `, пара ${no}` : ''}`}
                style={({ pressed }) => [styles.matchItem, styles.matchItemR, no !== null && styles.matchPaired, pressed && !done && styles.optPressed]}
              >
                {no !== null && <Text style={styles.pairNo}>{no}</Text>}
                <Text style={styles.matchTxt}>{r}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      {!done && <Button title="Перевірити" disabled={!allPaired(assign, step.pairs.length)} onPress={check} />}
    </View>
  );
}

// ─── Вписати число ───
const defaultTol = (f: { answer: number }) => Math.max(0.02, Math.abs(f.answer) * 0.01);
// Розбір числа й кнопка «±» — src/data/numInput.ts (ТЗ 006, 5.3): мінус «-», «−» або «–», кома чи крапка
export { parseNum } from '../data/numInput';

// Кнопка «±» біля кожного числового поля (ТЗ 006, 5.3): однакова для всіх полів, тож знак відповіді не підказується
export function SignButton({ onPress, disabled }: { onPress: () => void; disabled?: boolean }) {
  const styles = useStyles(makeStyles);
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={6} accessibilityRole="button" accessibilityLabel="Змінити знак числа" style={({ pressed }) => [styles.signBtn, pressed && { opacity: 0.6 }]}>
      <Text style={styles.signTxt}>±</Text>
    </Pressable>
  );
}

export function NumericStep({ step, resolution, onResolve }: Props<'numeric'>) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [vals, setVals] = useState<string[]>(() => step.fields.map(() => ''));
  const done = resolution !== null;
  const results = step.fields.map((f, i) => {
    const v = parseNum(vals[i] ?? '');
    return !Number.isNaN(v) && Math.abs(v - f.answer) <= (f.tolerance ?? defaultTol(f));
  });
  const check = () => onResolve(results.every(Boolean));
  const ready = vals.every((v) => v.trim() !== '' && !Number.isNaN(parseNum(v)));
  return (
    <View>
      <Text style={styles.hint}>Впиши відповідь числом</Text>
      {step.fields.map((f, i) => (
        <View key={i} style={{ marginBottom: 10 }}>
          <Text style={styles.fieldLabel}>{f.label}</Text>
          <View style={[styles.inputRow, done && (results[i] ? styles.optOk : styles.optNo)]}>
            <SignButton disabled={done} onPress={() => setVals((v) => v.map((x, xi) => (xi === i ? toggleSign(x) : x)))} />
            {f.unit === '$' && <Text style={styles.unit}>$</Text>}
            <TextInput
              style={styles.input}
              value={vals[i]}
              editable={!done}
              keyboardType={NUM_KEYBOARD}
              placeholder={NUM_PLACEHOLDER}
              placeholderTextColor={C.muted}
              onChangeText={(t) => setVals((v) => v.map((x, xi) => (xi === i ? t : x)))}
            />
            {f.unit && f.unit !== '$' && <Text style={styles.unit}>{f.unit}</Text>}
          </View>
          {done && !results[i] && (
            <Text style={styles.correctNote}>
              Правильно: {f.unit === '$' ? '$' : ''}
              {f.answer}
              {f.unit && f.unit !== '$' ? f.unit : ''}
            </Text>
          )}
        </View>
      ))}
      {!done && <Button title="Перевірити" disabled={!ready} onPress={check} />}
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  slotLabel: { color: C.goldTxt, fontWeight: '800', fontSize: 13, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  storyIntro: { color: C.muted, fontSize: 14, lineHeight: 21, marginBottom: 10 },
  storyBox: { backgroundColor: C.panel, borderRadius: 14, padding: 14, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: C.blue },
  storyTxt: { color: C.txt, fontSize: 15, lineHeight: 22 },
  storyFb: { fontWeight: '700', fontSize: 14, lineHeight: 20, marginBottom: 8 },
  hint: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 10, letterSpacing: 0.3 },
  opt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 16,
    padding: 15,
    marginBottom: 12,
    borderBottomWidth: 5,
  },
  optSel: { borderColor: C.blue, borderBottomColor: C.blueEdge, backgroundColor: C.blueTint },
  optOk: { borderColor: C.accent, backgroundColor: C.accentTint, borderBottomColor: C.accentEdge },
  optNo: { borderColor: C.red, backgroundColor: C.redTint, borderBottomColor: C.redEdge },
  optPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  optTxt: { color: C.txt, fontSize: 16, flex: 1 },
  box: { color: C.txt, fontSize: 18, fontWeight: '900', minWidth: 22, textAlign: 'center' },
  num: { color: C.accentTxt, fontSize: 16, fontWeight: '900', minWidth: 22, textAlign: 'center' },
  wrong: { color: C.redTxt, fontSize: 18, fontWeight: '900' },
  matchCols: { flexDirection: 'row', gap: 8, marginBottom: 6 },
  matchCol: { flex: 1, minWidth: 0 },
  matchItem: { backgroundColor: C.panel, borderColor: C.line, borderWidth: 2, borderBottomWidth: 5, borderRadius: 14, paddingVertical: 11, paddingHorizontal: 10, marginBottom: 8, minHeight: 56, justifyContent: 'center' },
  matchItemR: { backgroundColor: C.panel2 },
  matchPaired: { borderColor: C.blue, borderBottomColor: C.blueEdge },
  matchTxt: { color: C.txt, fontSize: 14, lineHeight: 19, fontWeight: '700', flexShrink: 1 },
  matchFix: { color: C.accentTxt, fontSize: 12, lineHeight: 17, marginTop: 4 },
  pairNo: { alignSelf: 'flex-start', color: C.blueTxt, backgroundColor: C.blueTint, fontSize: 11, fontWeight: '900', borderRadius: 8, paddingHorizontal: 6, paddingVertical: 1, marginBottom: 4, overflow: 'hidden' },
  chip: {
    backgroundColor: C.panel2,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    borderBottomWidth: 4,
    borderBottomColor: C.edge,
  },
  chipUsed: { opacity: 0.35 },
  fieldLabel: { color: C.txt, fontSize: 14, fontWeight: '700', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderRadius: 14,
    paddingHorizontal: 14,
    borderBottomWidth: 5,
  },
  input: { flex: 1, color: C.txt, fontSize: 20, fontWeight: '800', paddingVertical: 12 },
  unit: { color: C.muted, fontSize: 18, fontWeight: '800', marginHorizontal: 4 },
  signBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  signTxt: { color: C.txt, fontSize: 18, fontWeight: '900' },
  correctNote: { color: C.accentTxt, fontSize: 13, fontWeight: '700', marginTop: 4 },
});

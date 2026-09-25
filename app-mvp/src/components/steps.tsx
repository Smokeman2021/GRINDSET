import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput } from 'react-native';
import { C } from '../theme';
import { Button } from './Button';
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

// ─── Послідовність ───
export function OrderStep({ step, resolution, onResolve }: Props<'order'>) {
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
export function MatchStep({ step, resolution, onResolve }: Props<'match'>) {
  const rights = useMemo(
    () => shuffled(step.pairs.map((p) => p[1]), (a) => a.every((v, i) => v === step.pairs[i][1])),
    [step]
  );
  const [assign, setAssign] = useState<Record<number, number>>({}); // ліва позиція -> індекс у rights
  const [active, setActive] = useState<number | null>(null);
  const done = resolution !== null;
  const usedRights = Object.values(assign);

  const pickRight = (ri: number) => {
    if (done || active === null) return;
    setAssign((a) => {
      const next: Record<number, number> = {};
      for (const [l, r] of Object.entries(a)) if (r !== ri) next[Number(l)] = r;
      next[active] = ri;
      return next;
    });
    setActive(null);
  };
  const allAssigned = Object.keys(assign).length === step.pairs.length;
  const check = () => onResolve(step.pairs.every((p, li) => rights[assign[li]] === p[1]));

  return (
    <View>
      <Text style={styles.hint}>Торкнись елемента зліва, потім його пари внизу</Text>
      {step.pairs.map((p, li) => {
        const chosen = assign[li] !== undefined ? rights[assign[li]] : null;
        const ok = done && chosen === p[1];
        const bad = done && chosen !== p[1];
        return (
          <Pressable
            key={li}
            disabled={done}
            onPress={() => setActive((a) => (a === li ? null : li))}
            style={[styles.opt, styles.matchCard, active === li && styles.optSel, ok && styles.optOk, bad && styles.optNo]}
          >
            <Text style={styles.matchLeft}>{p[0]}</Text>
            <Text style={[styles.matchRight, !chosen && { color: C.muted }]}>
              {chosen ?? 'обери пару…'}
              {bad ? `\n✓ ${p[1]}` : ''}
            </Text>
          </Pressable>
        );
      })}
      {!done && (
        <View style={{ marginTop: 6 }}>
          {rights.map((r, ri) => {
            const used = usedRights.includes(ri);
            return (
              <Pressable
                key={ri}
                disabled={used && active === null}
                onPress={() => pickRight(ri)}
                style={({ pressed }) => [styles.chip, used && styles.chipUsed, pressed && styles.optPressed]}
              >
                <Text style={styles.optTxt}>{r}</Text>
              </Pressable>
            );
          })}
          <Button title="Перевірити" disabled={!allAssigned} onPress={check} />
        </View>
      )}
    </View>
  );
}

// ─── Вписати число ───
const defaultTol = (f: { answer: number }) => Math.max(0.02, Math.abs(f.answer) * 0.01);
const parseNum = (s: string) => parseFloat(s.replace(',', '.').replace(/[^\d.\-]/g, ''));

export function NumericStep({ step, resolution, onResolve }: Props<'numeric'>) {
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
            {f.unit === '$' && <Text style={styles.unit}>$</Text>}
            <TextInput
              style={styles.input}
              value={vals[i]}
              editable={!done}
              keyboardType="decimal-pad"
              placeholder="0"
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

const styles = StyleSheet.create({
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
  optSel: { borderColor: C.blue, borderBottomColor: C.blueEdge, backgroundColor: 'rgba(90,167,255,0.10)' },
  optOk: { borderColor: C.accent, backgroundColor: 'rgba(54,226,122,0.14)', borderBottomColor: C.accentEdge },
  optNo: { borderColor: C.red, backgroundColor: 'rgba(255,92,92,0.12)', borderBottomColor: C.redEdge },
  optPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
  optTxt: { color: C.txt, fontSize: 16, flex: 1 },
  box: { color: C.txt, fontSize: 18, fontWeight: '900', minWidth: 22, textAlign: 'center' },
  num: { color: C.accent, fontSize: 16, fontWeight: '900', minWidth: 22, textAlign: 'center' },
  wrong: { color: C.red, fontSize: 18, fontWeight: '900' },
  matchCard: { flexDirection: 'column', alignItems: 'flex-start', gap: 4 },
  matchLeft: { color: C.txt, fontSize: 16, fontWeight: '800' },
  matchRight: { color: C.accent, fontSize: 14 },
  chip: {
    backgroundColor: C.panel2,
    borderRadius: 14,
    padding: 13,
    marginBottom: 8,
    borderBottomWidth: 4,
    borderBottomColor: '#0a0c10',
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
  correctNote: { color: C.accent, fontSize: 13, fontWeight: '700', marginTop: 4 },
});

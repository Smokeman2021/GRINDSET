// Стаття «Бази» за єдиним ID (ТЗ 004, B4–B10). Відкривається з «Бази», з підказки терміна в уроці, з гілки й тренажера.
// «Назад» повертає на попередній екран у тому самому стані (урок лишається змонтованим у стеку, відповідь кроку зберігається).
// Розбір кейсу й еталон вправи показуються лише після спроби. Відмітки чекліста й поля шаблону зберігаються лише на пристрої.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Markdown } from '../../src/components/Markdown';
import { Button } from '../../src/components/Button';
import { useStore } from '../../src/store';
import { fieldCorrect, kbGet, KB_KIND_LABEL, labelText, templateParts, type KbField } from '../../src/data/kb';
import { localKv } from '../../src/cloud/storage';
import { Theme, useStyles, useTheme } from '../../src/theme';

export default function KbArticleScreen() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id, ret } = useLocalSearchParams<{ id: string; ret?: string }>();
  const lang = useStore((s) => s.lang);
  const a = useMemo(() => (id ? kbGet(String(id), lang) : null), [id, lang]);
  // «Продовжити» (етап E): стаття — останнє місце; якщо її відкрито з уроку чи тренажера, зберігаємо, куди повернутись
  const [retTo] = useState(() => {
    const cur = useStore.getState().placeBox?.place ?? null;
    return cur?.kind === 'kb' ? cur.back : cur ?? undefined;
  });
  useEffect(() => {
    if (a) useStore.getState().setPlace({ kind: 'kb', id: a.id, title: `«База» · ${a.title}`, back: retTo, at: Date.now() });
  }, [a?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const back = () => {
    // повернення: місцем знову стає урок / тренажер, з якого відкрили статтю
    if (retTo) useStore.getState().setPlace(retTo);
    if (ret === '1' && retTo) return router.replace(retTo.kind === 'sim' ? '/leads' : `/lesson/${retTo.id}`);
    return router.canGoBack() ? router.back() : router.replace('/library');
  };

  if (!a) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.title}>Статтю не знайдено</Text>
        <Button title="Назад" onPress={back} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 40 }}>
        <Pressable onPress={back} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Назад">
          <Text style={styles.backTxt}>{ret === '1' && retTo ? `← Повернутись: ${retTo.title}` : '← Назад'}</Text>
        </Pressable>
        <Text style={styles.kicker}>
          {a.id}
          {KB_KIND_LABEL[a.kind] ? ` · ${KB_KIND_LABEL[a.kind]}` : ''}
        </Text>
        <Text style={styles.title}>{a.title}</Text>
        {a.fallback && <Text style={styles.fallback}>Перекладу цією мовою ще немає: відкрито українською.</Text>}
        {a.labels.length > 0 && (
          <View style={styles.labels}>
            {a.labels.map((l) => (
              <View key={l} style={[styles.label, l === 'self-report' && { borderColor: C.red }]}>
                <Text style={styles.labelTxt}>{labelText(l)}</Text>
              </View>
            ))}
          </View>
        )}

        {a.kind === 'template' ? <Template id={a.id} body={a.body} /> : <Markdown text={a.body} />}

        {a.exercise ? <Exercise id={a.id} fields={a.exercise.fields} criteria={a.exercise.criteria} etalon={a.solution ?? ''} /> : a.solution ? <Solution text={a.solution} /> : null}
      </ScrollView>
    </View>
  );
}

// Розбір кейсу: спершу власна відповідь (необовʼязково), потім «Показати розбір»
function Solution({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  const [mine, setMine] = useState('');
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.box}>
      <Text style={styles.boxTitle}>Твоя відповідь</Text>
      <TextInput value={mine} onChangeText={setMine} multiline placeholder="Запиши розрахунок і рішення (необовʼязково)" placeholderTextColor="#8892a0" style={[styles.input, { minHeight: 70 }]} />
      {!open ? (
        <Button title="Показати розбір" onPress={() => setOpen(true)} />
      ) : (
        <View testID="kb-solution">
          <Text style={styles.boxTitle}>Розбір</Text>
          <Markdown text={text} small />
        </View>
      )}
    </View>
  );
}

// Вправа з вводом: перевірка полів, потім еталон і критерії (ТЗ 004, B9)
function Exercise({ id, fields, criteria, etalon }: { id: string; fields: KbField[]; criteria: string[]; etalon: string }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [checked, setChecked] = useState(false);
  const [note, setNote] = useState('');
  const set = (fid: string, v: unknown) => {
    setVals((x) => ({ ...x, [fid]: v }));
    setChecked(false);
  };
  const ok = (f: KbField) => fieldCorrect(f, vals[f.id]);
  const score = fields.filter(ok).length;
  return (
    <View style={styles.box} testID={`kb-exercise-${id}`}>
      <Text style={styles.boxTitle}>Вправа</Text>
      {fields.map((f) => (
        <View key={f.id} style={styles.field}>
          <Text style={styles.fieldLabel}>
            {f.label}
            {f.type === 'number' && f.unit ? `, ${f.unit}` : ''}
          </Text>
          {f.type === 'number' && (
            <TextInput value={String(vals[f.id] ?? '')} onChangeText={(t) => set(f.id, t)} keyboardType="numeric" inputMode="decimal" style={styles.input} placeholder="Число" placeholderTextColor="#8892a0" />
          )}
          {(f.type === 'choice' || f.type === 'multi') &&
            f.options.map((o, i) => {
              const sel = f.type === 'choice' ? vals[f.id] === i : Array.isArray(vals[f.id]) && (vals[f.id] as number[]).includes(i);
              const toggle = () => {
                if (f.type === 'choice') set(f.id, i);
                else {
                  const cur = Array.isArray(vals[f.id]) ? (vals[f.id] as number[]) : [];
                  set(f.id, cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]);
                }
              };
              return (
                <Pressable key={i} onPress={toggle} style={[styles.opt, sel && styles.optOn]} accessibilityRole={f.type === 'choice' ? 'radio' : 'checkbox'} accessibilityState={{ checked: sel }}>
                  <Text style={styles.optTxt}>
                    {f.type === 'multi' ? (sel ? '☑ ' : '☐ ') : sel ? '◉ ' : '○ '}
                    {o}
                  </Text>
                </Pressable>
              );
            })}
          {checked && <Text style={[styles.verdict, { color: ok(f) ? C.accentTxt : C.redTxt }]}>{ok(f) ? '✓ Правильно' : '✗ Не так: подивись розбір нижче'}</Text>}
        </View>
      ))}
      <Text style={styles.fieldLabel}>Твоє пояснення (необовʼязково, не оцінюється)</Text>
      <TextInput value={note} onChangeText={setNote} multiline style={[styles.input, { minHeight: 60 }]} />
      <Button title={checked ? 'Перевірити ще раз' : 'Перевірити'} onPress={() => setChecked(true)} />
      {checked && (
        <View testID="kb-etalon">
          <Text style={styles.score}>
            Правильно: {score} з {fields.length}
          </Text>
          <Text style={styles.boxTitle}>Еталон</Text>
          <Markdown text={etalon} small />
          {note.trim().length > 0 && (
            <>
              <Text style={styles.boxTitle}>Твоє пояснення</Text>
              <Text style={styles.noteTxt}>{note}</Text>
            </>
          )}
          <Text style={styles.boxTitle}>Критерії</Text>
          {criteria.map((c) => (
            <Text key={c} style={styles.li}>
              • {c}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

// Шаблон M22: інтерактивний чекліст + поля шаблону рішення/перевірки/брифу (ТЗ 004, B8). Лише на пристрої.
function Template({ id, body }: { id: string; body: string }) {
  const styles = useStyles(makeStyles);
  const parts = useMemo(() => templateParts(body), [body]);
  const key = `grindset-kb-template:${id}`;
  const [state, setState] = useState<{ checks: Record<number, boolean>; fields: Record<string, string> }>({ checks: {}, fields: {} });
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    localKv
      .get(key)
      .then((raw) => {
        if (raw) setState(JSON.parse(raw));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  }, [key]);
  useEffect(() => {
    if (loaded) localKv.set(key, JSON.stringify(state)).catch(() => undefined);
  }, [state, loaded, key]);
  const done = parts.steps.filter((_, i) => state.checks[i]).length;
  return (
    <View>
      {parts.rest.length > 0 && <Markdown text={parts.rest} />}
      {parts.steps.length > 0 && (
        <View style={styles.box}>
          <Text style={styles.boxTitle}>
            Чекліст · {done} з {parts.steps.length}
          </Text>
          {parts.steps.map((s, i) => (
            <Pressable key={i} onPress={() => setState((x) => ({ ...x, checks: { ...x.checks, [i]: !x.checks[i] } }))} style={styles.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked: !!state.checks[i] }}>
              <Text style={styles.checkBox}>{state.checks[i] ? '☑' : '☐'}</Text>
              <Text style={[styles.checkTxt, state.checks[i] && styles.checkDone]}>{s}</Text>
            </Pressable>
          ))}
        </View>
      )}
      {parts.forms.map((f) => (
        <View key={f.title} style={styles.box}>
          <Text style={styles.boxTitle}>{f.title}</Text>
          {f.fields.map((name) => (
            <View key={name} style={styles.field}>
              <Text style={styles.fieldLabel}>{name}</Text>
              <TextInput value={state.fields[`${f.title}|${name}`] ?? ''} onChangeText={(t) => setState((x) => ({ ...x, fields: { ...x.fields, [`${f.title}|${name}`]: t } }))} style={styles.input} />
            </View>
          ))}
        </View>
      ))}
      <Text style={styles.localNote}>Відмітки й поля зберігаються лише на цьому пристрої.</Text>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    backBtn: { alignSelf: 'flex-start', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel, marginBottom: 12 },
    backTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 14 },
    kicker: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 0.6 },
    title: { color: C.txt, fontWeight: '900', fontSize: 22, marginTop: 4, marginBottom: 10 },
    fallback: { color: C.goldTxt, fontSize: 13, marginBottom: 10 },
    labels: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
    label: { borderWidth: 1.5, borderColor: C.gold, borderRadius: 10, paddingVertical: 3, paddingHorizontal: 8 },
    labelTxt: { color: C.txt, fontSize: 12, fontWeight: '700' },
    box: { backgroundColor: C.panel, borderRadius: 16, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, padding: 14, marginTop: 12, gap: 6 },
    boxTitle: { color: C.txt, fontWeight: '900', fontSize: 15, marginTop: 6, marginBottom: 4 },
    field: { marginBottom: 10 },
    fieldLabel: { color: C.txt, fontWeight: '700', fontSize: 14, marginBottom: 6 },
    input: { borderWidth: 2, borderColor: C.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: C.txt, backgroundColor: C.panel2, fontSize: 15 },
    opt: { borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, borderRadius: 12, padding: 10, marginBottom: 6, backgroundColor: C.panel2 },
    optOn: { borderColor: C.accent },
    optTxt: { color: C.txt, fontSize: 14, lineHeight: 20 },
    verdict: { fontWeight: '800', fontSize: 13, marginTop: 4 },
    score: { color: C.txt, fontWeight: '900', fontSize: 16, marginTop: 10 },
    noteTxt: { color: C.muted, fontSize: 14, lineHeight: 20 },
    li: { color: C.txt, fontSize: 14, lineHeight: 21 },
    checkRow: { flexDirection: 'row', gap: 10, paddingVertical: 6 },
    checkBox: { color: C.accentTxt, fontSize: 18, lineHeight: 22 },
    checkTxt: { color: C.txt, fontSize: 14, lineHeight: 21, flex: 1 },
    checkDone: { color: C.muted, textDecorationLine: 'line-through' },
    localNote: { color: C.muted, fontSize: 12, marginTop: 10 },
  });

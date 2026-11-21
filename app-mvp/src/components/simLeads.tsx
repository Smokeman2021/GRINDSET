// Кроки й макети тренажера «Ліди» (ТЗ 004, етап D): цілі кампанії, рівні кабінету, список заявок, варіанти повтору,
// оголошення / лендинг / таблиці звіту — компонентами інтерфейсу, без зображень.
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Theme, useStyles, useTheme } from '../theme';
import { Button } from './Button';
import { Markdown } from './Markdown';
import type { Resolution } from './steps';
import { AD_FIELD_LABELS, AD_FIELDS_UNVERIFIED, GOALS, LEAD_MARKS, LEADS, LEVEL_ITEMS, VARIANT_B_CHECK, VARIANTS, type AdMock, type Row, type Variant } from '../data/simLeads';
import { LEVEL_LABEL, leadsOk, levelsOk, type Level } from '../data/simLeadsRules';

// ───────── Макети ─────────
export function AdCard({ ad, flag }: { ad: AdMock; flag?: 'bad' | 'ok' }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={[styles.ad, flag === 'bad' && { borderColor: C.red }, flag === 'ok' && { borderColor: C.accent }]}>
      <View style={styles.adHead}>
        <View style={styles.avatar}>
          <Text style={{ fontSize: 14 }}>🥤</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.adPage}>Vitok · Реклама</Text>
          <Text style={styles.adNum}>Оголошення {ad.n}</Text>
        </View>
      </View>
      <Text style={styles.fieldLbl}>{AD_FIELD_LABELS.primary}</Text>
      <Text style={styles.adPrimary}>{ad.primary}</Text>
      <View style={styles.adMedia}>
        <Text style={{ fontSize: 34 }}>🥤</Text>
        <Text style={styles.adMediaTxt}>макет зображення</Text>
      </View>
      <View style={styles.adFoot}>
        <View style={{ flex: 1 }}>
          <Text style={styles.fieldLbl}>{AD_FIELD_LABELS.headline}</Text>
          <Text style={styles.adHeadline}>{ad.headline}</Text>
          <Text style={styles.fieldLbl}>{AD_FIELD_LABELS.description}</Text>
          <Text style={styles.adDesc}>{ad.description}</Text>
        </View>
        <View style={styles.adBtn}>
          <Text style={styles.fieldLblCenter}>{AD_FIELD_LABELS.button}</Text>
          <Text style={styles.adBtnTxt}>{ad.button}</Text>
        </View>
      </View>
    </View>
  );
}

export function UnverifiedNote() {
  const styles = useStyles(makeStyles);
  if (!AD_FIELDS_UNVERIFIED) return null;
  return <Text style={styles.small}>Підписи полів оголошення — навчальні: у кабінеті вони не звірені.</Text>;
}

export function LandingMock({ l }: { l: { title: string; price: string; terms: string; form: string[]; button: string } }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.land}>
      <Text style={styles.landBar}>🔒 vitok-blender.example · перший екран</Text>
      <Text style={styles.landTitle}>{l.title}</Text>
      <Text style={styles.landPrice}>{l.price}</Text>
      <Text style={styles.landTerms}>{l.terms}</Text>
      {l.form.map((f) => (
        <View key={f} style={styles.landInput}>
          <Text style={styles.landInputTxt}>{f}</Text>
        </View>
      ))}
      <View style={styles.landBtn}>
        <Text style={styles.landBtnTxt}>{l.button}</Text>
      </View>
    </View>
  );
}

export function ReportTable({ title, rows }: { title: string; rows: Row[] }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.table}>
      <Text style={styles.tableTitle}>{title}</Text>
      {rows.map(([k, v], i) => (
        <View key={i} style={[styles.tr, i % 2 === 1 && styles.trAlt]}>
          <Text style={styles.td}>{k}</Text>
          <Text style={styles.tdVal}>{v}</Text>
        </View>
      ))}
    </View>
  );
}

// ───────── Ціль кампанії: кожна відкриває пояснення; «Ліди» — повний цикл, «Продажі» — тільки пояснення ─────────
export function GoalsStep({ seen, onSeen, onPick }: { seen: string[]; onSeen: (id: string) => void; onPick: () => void }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [open, setOpen] = useState<string | null>(null);
  const g = GOALS.find((x) => x.id === open);
  return (
    <View>
      <Text style={styles.cabLabel}>«Ціль кампанії»</Text>
      {GOALS.map((x) => (
        <Pressable
          key={x.id}
          onPress={() => {
            setOpen(x.id);
            onSeen(x.id);
          }}
          style={({ pressed }) => [styles.opt, open === x.id && styles.optSel, pressed && styles.optPressed]}
        >
          <Text style={styles.box}>{open === x.id ? '●' : '○'}</Text>
          <Text style={styles.optTxt}>{x.label}</Text>
          {seen.includes(x.id) && <Text style={styles.seen}>переглянуто</Text>}
        </Pressable>
      ))}
      {g && (
        <View style={[styles.explainBox, g.pick && { borderLeftColor: C.accent }]}>
          {g.desc && <Text style={styles.cabDesc}>У кабінеті: «{g.desc}»</Text>}
          <Text style={styles.explainTxt}>{g.explain}</Text>
          {g.grindyk && <Text style={styles.grindyk}>🦝 {g.grindyk}</Text>}
          <View style={{ height: 10 }} />
          {g.pick ? (
            <Button title="Обрати «Ліди» і продовжити" onPress={onPick} />
          ) : (
            <Button title={g.secondCase ? 'Це другий кейс · повернутися до вибору' : 'Повернутися до вибору'} ghost onPress={() => setOpen(null)} />
          )}
        </View>
      )}
    </View>
  );
}

// ───────── Рівні кабінету ─────────
const LEVELS: Level[] = ['campaign', 'adset', 'ad'];
export function LevelsStep({ resolution, onResolve }: { resolution: Resolution; onResolve: (ok: boolean) => void }) {
  const styles = useStyles(makeStyles);
  const [sel, setSel] = useState<(Level | undefined)[]>(() => LEVEL_ITEMS.map(() => undefined));
  const done = resolution !== null;
  return (
    <View>
      <Text style={styles.hint}>«Кампанії» → «Набори реклами» → «Реклама»: обери рівень для кожного параметра</Text>
      {LEVEL_ITEMS.map((it, i) => (
        <View key={i} style={styles.lvRow}>
          <Text style={styles.lvItem}>
            {done ? (sel[i] === it.level ? '✓ ' : '✕ ') : ''}
            {it.label}
          </Text>
          <View style={styles.chips}>
            {LEVELS.map((lv) => {
              const isSel = sel[i] === lv;
              const right = it.level === lv;
              return (
                <Pressable
                  key={lv}
                  disabled={done}
                  onPress={() => setSel((p) => p.map((v, k) => (k === i ? lv : v)))}
                  style={[styles.chip, !done && isSel && styles.chipSel, done && right && styles.chipOk, done && isSel && !right && styles.chipNo]}
                >
                  <Text style={styles.chipTxt}>{LEVEL_LABEL[lv]}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
      {!done && <Button title="Перевірити" disabled={sel.some((v) => !v)} onPress={() => onResolve(levelsOk(LEVEL_ITEMS, sel))} />}
    </View>
  );
}

// ───────── Список заявок кабінету з позначками ─────────
type Mark = keyof typeof LEAD_MARKS;
export function LeadListStep({ resolution, onResolve }: { resolution: Resolution; onResolve: (ok: boolean) => void }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [marks, setMarks] = useState<Record<number, Mark>>({});
  const [active, setActive] = useState<number | null>(null);
  const done = resolution !== null;
  const picked = Object.keys(marks).map(Number);
  const check = () => onResolve(leadsOk(LEADS, picked) && picked.every((i) => LEADS[i].extra === marks[i]));
  return (
    <View>
      <Text style={styles.hint}>Торкнися рядка, якого немає в CRM, і познач, що це. Позначено: {picked.length} з 2</Text>
      <View style={styles.table}>
        <View style={[styles.tr, styles.trHead]}>
          <Text style={[styles.leadCell, { flex: 0.9 }]}>Час</Text>
          <Text style={styles.leadCell}>Імʼя</Text>
          <Text style={[styles.leadCell, { flex: 1.4 }]}>Телефон</Text>
          <Text style={[styles.leadCell, { flex: 0.6 }]}>CRM</Text>
        </View>
        {LEADS.map((r, i) => {
          const m = marks[i];
          const wrong = done && ((m && r.extra !== m) || (!m && r.extra));
          return (
            <View key={i}>
              <Pressable
                disabled={done}
                onPress={() => setActive(active === i ? null : i)}
                style={[styles.tr, i % 2 === 1 && styles.trAlt, m && { backgroundColor: C.goldTint }, done && r.extra && { backgroundColor: wrong ? C.redTint : C.accentTint }]}
              >
                <Text style={[styles.leadCell, { flex: 0.9 }]}>{r.t}</Text>
                <Text style={styles.leadCell}>{r.name}</Text>
                <Text style={[styles.leadCell, { flex: 1.4 }]}>{r.phone}</Text>
                <Text style={[styles.leadCell, { flex: 0.6 }]}>{r.crm ? '✓' : '—'}</Text>
              </Pressable>
              {(m || (done && r.extra)) && (
                <Text style={styles.leadMark}>
                  {m ? `🏷 ${LEAD_MARKS[m]}` : ''}
                  {done && r.extra && r.extra !== m ? `  → правильно: ${LEAD_MARKS[r.extra]}` : ''}
                </Text>
              )}
              {!done && active === i && (
                <View style={[styles.chips, { paddingHorizontal: 8, paddingBottom: 8 }]}>
                  {(Object.keys(LEAD_MARKS) as Mark[]).map((k) => (
                    <Pressable
                      key={k}
                      onPress={() => {
                        setMarks((p) => ({ ...p, [i]: k }));
                        setActive(null);
                      }}
                      style={[styles.chip, m === k && styles.chipSel]}
                    >
                      <Text style={styles.chipTxt}>{LEAD_MARKS[k]}</Text>
                    </Pressable>
                  ))}
                  {m && (
                    <Pressable
                      onPress={() => {
                        setMarks((p) => {
                          const n = { ...p };
                          delete n[i];
                          return n;
                        });
                        setActive(null);
                      }}
                      style={styles.chip}
                    >
                      <Text style={styles.chipTxt}>Зняти</Text>
                    </Pressable>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </View>
      {!done && <Button title="Перевірити" disabled={picked.length === 0} onPress={check} />}
    </View>
  );
}

// ───────── Варіант повтору: А / Б / В з результатом за варіантом ─────────
// Варіанти повтору (APPROVED п. 6). Перший вибір за прохід кроку — рішення (onDecide); інші варіанти можна переглянути.
// Б: пояснення результату → перевірочне питання «Що змінює варіант Б?» → onDecide з відповіддю (вона йде в точність).
export function VariantStep({ seen, onDecide, onView }: { seen: string[]; onDecide: (v: Variant, check?: boolean) => void; onView: (v: Variant) => void }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [cur, setCur] = useState<Variant | null>(null);
  const [decided, setDecided] = useState<Variant | null>(null);
  const [checkSel, setCheckSel] = useState<number | null>(null);
  const [checkDone, setCheckDone] = useState(false);
  const askB = decided?.id === 'B'; // рішення — Б: питання лишається на екрані до відповіді
  const showWhy = !!cur && (cur.id !== 'B' || !askB || checkDone);
  return (
    <View>
      {VARIANTS.map((v) => (
        <Pressable
          key={v.id}
          onPress={() => {
            setCur(v);
            onView(v);
            if (!decided) {
              setDecided(v);
              if (v.id !== 'B') onDecide(v);
              else onDecide(v, undefined);
            }
          }}
          style={({ pressed }) => [styles.opt, cur?.id === v.id && styles.optSel, pressed && styles.optPressed]}
        >
          <Text style={styles.box}>{cur?.id === v.id ? '●' : '○'}</Text>
          <Text style={styles.optTxt}>{v.label}</Text>
          {seen.includes(v.id) && <Text style={styles.seen}>переглянуто</Text>}
        </Pressable>
      ))}
      {cur && (
        <View style={[styles.explainBox, { borderLeftColor: cur.good ? C.accent : C.red }]}>
          {cur.rows ? <ReportTable title={`Варіант ${cur.label.split(' · ')[0]} · результат`} rows={cur.rows} /> : null}
          {cur.pre && cur.id === 'B' && askB && !checkDone ? <Text style={styles.explainTxt}>{cur.pre}</Text> : null}
          {showWhy ? <Text style={styles.explainTxt}>{cur.why}</Text> : null}
          {showWhy && cur.grindyk ? <Text style={styles.grindyk}>🦝 {cur.grindyk}</Text> : null}
        </View>
      )}
      {askB && (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.cabLabel}>{VARIANT_B_CHECK.q}</Text>
          {VARIANT_B_CHECK.options.map((o, k) => {
            const ok = checkDone && k === VARIANT_B_CHECK.answer;
            const bad = checkDone && k === checkSel && k !== VARIANT_B_CHECK.answer;
            return (
              <Pressable
                key={k}
                disabled={checkDone}
                onPress={() => setCheckSel(k)}
                style={({ pressed }) => [styles.opt, !checkDone && checkSel === k && styles.optSel, ok && styles.optOk, bad && styles.optNo, pressed && !checkDone && styles.optPressed]}
              >
                <Text style={styles.optTxt}>{o}</Text>
              </Pressable>
            );
          })}
          {!checkDone && (
            <Button
              title="Перевірити"
              disabled={checkSel === null}
              onPress={() => {
                setCheckDone(true);
                onDecide(VARIANTS[1], checkSel === VARIANT_B_CHECK.answer);
              }}
            />
          )}
        </View>
      )}
    </View>
  );
}

export function Kicker({ children }: { children: React.ReactNode }) {
  const styles = useStyles(makeStyles);
  return <Text style={styles.kicker}>{children}</Text>;
}

export function MdBox({ text }: { text: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.mdBox}>
      <Markdown text={text} small />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    hint: { color: C.muted, fontSize: 13, marginBottom: 10 },
    small: { color: C.muted, fontSize: 11, fontStyle: 'italic', marginTop: 4, marginBottom: 8 },
    kicker: { color: C.muted, fontSize: 11, fontWeight: '900', letterSpacing: 1, marginTop: 12, marginBottom: 6 },
    mdBox: { backgroundColor: C.panel2, borderRadius: 12, padding: 12, borderLeftWidth: 3, borderLeftColor: C.gold, marginBottom: 6 },
    // оголошення
    ad: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, padding: 12, marginBottom: 10 },
    adHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
    adPage: { color: C.txt, fontWeight: '800', fontSize: 13 },
    adNum: { color: C.muted, fontSize: 11 },
    fieldLbl: { color: C.muted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5, marginTop: 4 },
    fieldLblCenter: { color: C.muted, fontSize: 9, fontWeight: '800', textAlign: 'center' },
    adPrimary: { color: C.txt, fontSize: 14, lineHeight: 20 },
    adMedia: { height: 90, borderRadius: 10, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center', marginVertical: 8 },
    adMediaTxt: { color: C.muted, fontSize: 11 },
    adFoot: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
    adHeadline: { color: C.txt, fontWeight: '800', fontSize: 14 },
    adDesc: { color: C.muted, fontSize: 12 },
    adBtn: { backgroundColor: C.panel2, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, borderWidth: 1, borderColor: C.line },
    adBtnTxt: { color: C.txt, fontWeight: '800', fontSize: 13, textAlign: 'center' },
    // лендинг
    land: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, padding: 12, marginBottom: 10, gap: 6 },
    landBar: { color: C.muted, fontSize: 11, backgroundColor: C.panel2, borderRadius: 6, paddingVertical: 4, paddingHorizontal: 8 },
    landTitle: { color: C.txt, fontWeight: '900', fontSize: 18 },
    landPrice: { color: C.accentTxt, fontWeight: '900', fontSize: 22 },
    landTerms: { color: C.txt, fontSize: 13 },
    landInput: { borderWidth: 2, borderColor: C.line, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
    landInputTxt: { color: C.muted, fontSize: 13 },
    landBtn: { backgroundColor: C.accent, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: C.accentEdge },
    landBtnTxt: { color: C.onAccent, fontWeight: '900', fontSize: 15 },
    // таблиці
    table: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 2, borderColor: C.line, overflow: 'hidden', marginBottom: 10 },
    tableTitle: { color: C.txt, fontWeight: '900', fontSize: 13, padding: 10, backgroundColor: C.panel2 },
    tr: { flexDirection: 'row', paddingVertical: 7, paddingHorizontal: 10, gap: 8 },
    trAlt: { backgroundColor: C.panel2 },
    trHead: { backgroundColor: C.panel2 },
    td: { flex: 1.4, color: C.txt, fontSize: 13 },
    tdVal: { flex: 1, color: C.txt, fontSize: 13, fontWeight: '800', textAlign: 'right' },
    leadCell: { flex: 1, color: C.txt, fontSize: 12 },
    leadMark: { color: C.goldTxt, fontSize: 12, fontWeight: '800', paddingHorizontal: 10, paddingBottom: 6 },
    // варіанти
    opt: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.panel, borderColor: C.line, borderWidth: 2, borderBottomWidth: 5, borderRadius: 16, padding: 13, marginBottom: 10 },
    optSel: { borderColor: C.blue, backgroundColor: C.panel2, borderBottomColor: C.blueEdge },
    optOk: { borderColor: C.accent, backgroundColor: C.accentTint, borderBottomColor: C.accentEdge },
    optNo: { borderColor: C.red, backgroundColor: C.redTint, borderBottomColor: C.redEdge },
    optPressed: { transform: [{ translateY: 3 }], borderBottomWidth: 2 },
    optTxt: { flex: 1, color: C.txt, fontSize: 15 },
    box: { color: C.blueTxt, fontSize: 16, width: 18 },
    seen: { color: C.muted, fontSize: 11 },
    cabLabel: { color: C.muted, fontSize: 12, fontWeight: '800', marginBottom: 6 },
    cabDesc: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginBottom: 6 },
    explainBox: { backgroundColor: C.panel2, borderRadius: 12, padding: 12, borderLeftWidth: 4, borderLeftColor: C.blue, marginTop: 4 },
    explainTxt: { color: C.txt, fontSize: 14, lineHeight: 20 },
    grindyk: { color: C.muted, fontSize: 13, fontStyle: 'italic', marginTop: 8, lineHeight: 19 },
    // рівні
    lvRow: { backgroundColor: C.panel, borderRadius: 12, borderWidth: 2, borderColor: C.line, padding: 10, marginBottom: 8 },
    lvItem: { color: C.txt, fontSize: 14, fontWeight: '700', marginBottom: 6 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    chip: { borderRadius: 10, borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, paddingVertical: 5, paddingHorizontal: 9, backgroundColor: C.panel },
    chipSel: { borderColor: C.blue, backgroundColor: C.blueTint },
    chipOk: { borderColor: C.accent, backgroundColor: C.accentTint },
    chipNo: { borderColor: C.red, backgroundColor: C.redTint },
    chipTxt: { color: C.txt, fontSize: 12, fontWeight: '800' },
  });

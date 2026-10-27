import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Theme, useStyles, useTheme } from '../theme';
import { advise, daysAgo, DEFAULT_PARAMS, type AdvisorParams, type BidHistory, type BudgetMode, type Structure } from '../data/advisor';

// «Порадник» v1: ручний ввід цифр з кабінету → одна конкретна дія й чому. Правила: src/data/advisor.ts (детерміновані, без AI).
// Підказка для досвідчених: рішення завжди за тобою.
const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};

function Field({ label, value, onChange, suffix, placeholder, keyboard = 'decimal-pad' }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; placeholder?: string; keyboard?: 'decimal-pad' | 'default' }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType={keyboard} placeholder={placeholder ?? '0'} placeholderTextColor={C.muted} />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Choice<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; label: string }[]; onChange: (v: T) => void }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.seg}>
        {options.map((o) => (
          <Pressable key={o.id} onPress={() => onChange(o.id)} style={[styles.segBtn, value === o.id && styles.segOn]}>
            <Text style={[styles.segTxt, value === o.id && { color: C.onAccent }]}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const TONE: Record<string, 'good' | 'bad' | 'warn' | 'info'> = {
  raise_budget: 'good',
  raise_bid: 'info',
  hold: 'info',
  wait: 'warn',
  split: 'warn',
  restart: 'warn',
  new_launch: 'bad',
  kill: 'bad',
  invalid: 'warn',
};

export function Advisor() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [level, setLevel] = useState<'campaign' | 'adset'>('adset');
  const [budget, setBudget] = useState('');
  const [spend, setSpend] = useState('');
  const [days, setDays] = useState<'2' | '3'>('2');
  const [cpl, setCpl] = useState('');
  const [leads, setLeads] = useState('');
  const [bid, setBid] = useState('');
  const [bidHistory, setBidHistory] = useState<BidHistory>('none');
  const [mode, setMode] = useState<BudgetMode>('ABO');
  const [structure, setStructure] = useState<Structure>('1-1-1');
  const [launch, setLaunch] = useState('');
  const [change, setChange] = useState('');
  const [swings, setSwings] = useState(false);
  const [badSetup, setBadSetup] = useState(false);
  const [threshold, setThreshold] = useState(String(DEFAULT_PARAMS.cplThreshold));
  const [showParams, setShowParams] = useState(false);
  const [killSpend, setKillSpend] = useState(String(DEFAULT_PARAMS.killSpendMult));
  const [killCpl, setKillCpl] = useState(String(DEFAULT_PARAMS.killCplMult));
  const [asked, setAsked] = useState(false);

  const result = useMemo(() => {
    if (!asked) return null;
    const params: AdvisorParams = {
      ...DEFAULT_PARAMS,
      cplThreshold: num(threshold) > 0 ? num(threshold) : DEFAULT_PARAMS.cplThreshold,
      killSpendMult: num(killSpend) > 0 ? num(killSpend) : DEFAULT_PARAMS.killSpendMult,
      killCplMult: num(killCpl) > 0 ? num(killCpl) : DEFAULT_PARAMS.killCplMult,
    };
    const cplN = num(cpl);
    return advise(
      {
        level,
        budget: num(budget),
        spend: Number.isFinite(num(spend)) ? num(spend) : 0,
        days: Number(days),
        cpl: cplN > 0 ? cplN : null,
        leadsPerDay: Number.isFinite(num(leads)) ? num(leads) : 0,
        bid: num(bid) > 0 ? num(bid) : null,
        bidHistory,
        mode,
        structure,
        daysSinceLaunch: daysAgo(launch) ?? 0,
        daysSinceChange: daysAgo(change) ?? 99, // дату не вказано → вважаємо, що давно
        swings,
        badSetup,
      },
      params
    );
  }, [asked, level, budget, spend, days, cpl, leads, bid, bidHistory, mode, structure, launch, change, swings, badSetup, threshold, killSpend, killCpl]);

  const tone = result ? TONE[result.code] : 'info';
  const toneColor = tone === 'good' ? C.accent : tone === 'bad' ? C.red : tone === 'warn' ? C.gold : C.blue;

  return (
    <View>
      <View style={styles.card}>
        <Text style={styles.title}>🧭 Порадник</Text>
        <Text style={styles.hint}>
          Введи цифри з кабінету, отримаєш одну дію й коротке «чому». Це підказка за правилами курсу, а не гарантія; рішення за тобою. Розрахований на тих, хто вже запускав рекламу.
        </Text>

        <Choice label="Що аналізуємо" value={level} onChange={setLevel} options={[{ id: 'adset', label: 'Групу оголошень' }, { id: 'campaign', label: 'Кампанію' }]} />
        <Field label="Денний бюджет" value={budget} onChange={setBudget} suffix="$" />
        <Choice label="Витрати за скільки днів" value={days} onChange={setDays} options={[{ id: '2', label: '2 дні' }, { id: '3', label: '3 дні' }]} />
        <Field label="Витрати за цей період" value={spend} onChange={setSpend} suffix="$" />
        <Field label="Поточний CPL (ціна ліда); порожньо, якщо лідів нема" value={cpl} onChange={setCpl} suffix="$" />
        <Field label="Лідів на день" value={leads} onChange={setLeads} />
        <Field label="Контрольна ставка (якщо є)" value={bid} onChange={setBid} suffix="$" />
        <Choice
          label="Історія ставки"
          value={bidHistory}
          onChange={setBidHistory}
          options={[
            { id: 'none', label: 'Не піднімали' },
            { id: 'few', label: '1–2 рази' },
            { id: 'many', label: '3+ / перезапуски' },
          ]}
        />
        <Choice label="Бюджет" value={mode} onChange={setMode} options={[{ id: 'ABO', label: 'ABO' }, { id: 'CBO', label: 'CBO' }]} />
        <Choice
          label="Структура (кампанія-група-оголошення)"
          value={structure}
          onChange={setStructure}
          options={[{ id: '1-1-1', label: '1-1-1' }, { id: '1-2-1', label: '1-2-1' }, { id: '1-3-1', label: '1-3-1' }]}
        />
        <Field label="Дата запуску (РРРР-ММ-ДД або скільки днів тому)" value={launch} onChange={setLaunch} placeholder="2026-10-20 або 7" keyboard="default" />
        <Field label="Остання зміна (РРРР-ММ-ДД або скільки днів тому)" value={change} onChange={setChange} placeholder="2026-10-25 або 2" keyboard="default" />

        <Choice label="Витрати чи CPL стрибають день у день («качелі»)" value={swings ? 'yes' : 'no'} onChange={(v) => setSwings(v === 'yes')} options={[{ id: 'no', label: 'Ні' }, { id: 'yes', label: 'Так' }]} />
        <Choice label="Сет-ап поганий (структура, аудиторія, плейсменти не за схемою)" value={badSetup ? 'yes' : 'no'} onChange={(v) => setBadSetup(v === 'yes')} options={[{ id: 'no', label: 'Ні' }, { id: 'yes', label: 'Так' }]} />

        <Field label="Поріг CPL (твій; за замовчуванням $3)" value={threshold} onChange={setThreshold} suffix="$" />
        <Pressable onPress={() => setShowParams((o) => !o)} style={styles.paramsBtn}>
          <Text style={styles.paramsTxt}>{showParams ? '▲' : '▼'} Пороги «коли вбивати офер/товар»</Text>
        </Pressable>
        {showParams && (
          <View>
            <Field label="Витрати без жодного ліда ≥ скільки порогів CPL" value={killSpend} onChange={setKillSpend} suffix="×" />
            <Field label="CPL ≥ скільки порогів (після 4+ днів і правок ставки)" value={killCpl} onChange={setKillCpl} suffix="×" />
            <Text style={styles.hint}>Це робочі значення за замовчуванням, постав свої.</Text>
          </View>
        )}

        <Pressable onPress={() => setAsked(true)} style={styles.go}>
          <Text style={styles.goTxt}>Порадити</Text>
        </Pressable>
      </View>

      {result && (
        <View style={[styles.result, { borderColor: toneColor }]}>
          <Text style={[styles.rTitle, { color: toneColor }]}>{result.title}</Text>
          {result.why.map((w, i) => (
            <Text key={i} style={styles.why}>
              • {w}
            </Text>
          ))}
          <Text style={styles.disclaimer}>Підказка, рішення за тобою.</Text>
        </View>
      )}
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
    title: { color: C.txt, fontWeight: '900', fontSize: 17 },
    hint: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10 },
    field: { marginBottom: 10 },
    label: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
    inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10 },
    input: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '700', paddingVertical: 8 },
    suffix: { color: C.muted, fontWeight: '700' },
    seg: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    segBtn: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2 },
    segOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    segTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
    paramsBtn: { paddingVertical: 6, marginBottom: 6 },
    paramsTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 13 },
    go: { alignItems: 'center', paddingVertical: 13, borderRadius: 14, borderWidth: 2, borderBottomWidth: 5, borderColor: C.accentEdge, backgroundColor: C.accent, marginTop: 6 },
    goTxt: { color: C.onAccent, fontWeight: '900', fontSize: 16 },
    result: { backgroundColor: C.panel, borderRadius: 16, padding: 14, borderWidth: 2, borderBottomWidth: 5, marginBottom: 12 },
    rTitle: { fontWeight: '900', fontSize: 17, marginBottom: 6 },
    why: { color: C.txt, fontSize: 14, lineHeight: 20, marginTop: 4 },
    disclaimer: { color: C.muted, fontSize: 12, fontStyle: 'italic', marginTop: 10 },
  });

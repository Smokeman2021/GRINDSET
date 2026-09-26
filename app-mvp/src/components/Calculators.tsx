import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { C } from '../theme';

// Прості калькулятори медіабаєра. Усі рахунки локальні; це допомога, а не гарантія результату.
const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : NaN;
};
const money = (v: number) => (Number.isFinite(v) ? `$${v.toFixed(2)}` : '—');
const pct = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}%` : '—');

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (v: string) => void; suffix?: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={C.muted}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Result({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <View style={styles.result}>
      <Text style={styles.rLabel}>{label}</Text>
      <Text style={[styles.rValue, tone === 'good' && { color: C.accent }, tone === 'bad' && { color: C.red }]}>{value}</Text>
    </View>
  );
}

// 1. Беззбитковий CPA і ROI
function Breakeven() {
  const [payout, setPayout] = useState('12');
  const [approve, setApprove] = useState('40');
  const [spend, setSpend] = useState('100');
  const [leads, setLeads] = useState('10');
  const p = num(payout);
  const a = num(approve) / 100;
  const sp = num(spend);
  const l = num(leads);
  const breakEvenCpl = p * a; // скільки можна платити за ліда, щоб вийти в нуль
  const cpl = sp / l;
  const income = l * a * p;
  const roi = ((income - sp) / sp) * 100;
  const profit = income - sp;
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Беззбитковість і ROI</Text>
      <Text style={styles.hint}>Скільки можна платити за ліда, щоб не піти в мінус, з урахуванням апруву.</Text>
      <Field label="Виплата за апрувнутий лід" value={payout} onChange={setPayout} suffix="$" />
      <Field label="Апрув-рейт" value={approve} onChange={setApprove} suffix="%" />
      <Field label="Витрати на рекламу" value={spend} onChange={setSpend} suffix="$" />
      <Field label="Отримано лідів" value={leads} onChange={setLeads} suffix="шт" />
      <Result label="Беззбитковий CPL" value={money(breakEvenCpl)} />
      <Result label="Твій CPL" value={money(cpl)} tone={cpl <= breakEvenCpl ? 'good' : 'bad'} />
      <Result label="Прибуток" value={money(profit)} tone={profit >= 0 ? 'good' : 'bad'} />
      <Result label="ROI" value={pct(roi)} tone={roi >= 0 ? 'good' : 'bad'} />
    </View>
  );
}

// 2. Метрики з сирих даних
function Metrics() {
  const [spend, setSpend] = useState('50');
  const [impr, setImpr] = useState('20000');
  const [clicks, setClicks] = useState('300');
  const [leads, setLeads] = useState('12');
  const sp = num(spend);
  const im = num(impr);
  const cl = num(clicks);
  const ld = num(leads);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Метрики кампанії</Text>
      <Text style={styles.hint}>Введи дані з кабінету. Порахую CPM, CTR, CPC, CR і CPA.</Text>
      <Field label="Витрати" value={spend} onChange={setSpend} suffix="$" />
      <Field label="Покази" value={impr} onChange={setImpr} />
      <Field label="Кліки" value={clicks} onChange={setClicks} />
      <Field label="Ліди" value={leads} onChange={setLeads} />
      <Result label="CPM" value={money((sp / im) * 1000)} />
      <Result label="CTR" value={pct((cl / im) * 100)} />
      <Result label="CPC" value={money(sp / cl)} />
      <Result label="CR (клік → лід)" value={pct((ld / cl) * 100)} />
      <Result label="CPA" value={money(sp / ld)} />
    </View>
  );
}

// 3. Правило гранічної вартості ліда (модуль 08)
function Threshold() {
  const [first, setFirst] = useState('3');
  const [budget, setBudget] = useState('20');
  const f = num(first);
  const b = num(budget);
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Гранична вартість ліда</Text>
      <Text style={styles.hint}>
        Правило з курсу: якщо перший лід прийшов за X, докручуєш до X + 15–20%. Не прийшов другий, вимикаєш. Це практика, а не закон Meta.
      </Text>
      <Field label="Вартість першого ліда" value={first} onChange={setFirst} suffix="$" />
      <Field label="Денний бюджет адсета" value={budget} onChange={setBudget} suffix="$" />
      <Result label="Докручуєш до" value={`${money(f * 1.15)} – ${money(f * 1.2)}`} />
      <Result label="Не давати відкрутити без лідів" value={money(b * 0.5)} tone="bad" />
    </View>
  );
}

export function Calculators() {
  return (
    <View>
      <Breakeven />
      <Metrics />
      <Threshold />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
  },
  title: { color: C.txt, fontWeight: '900', fontSize: 17 },
  hint: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 4, marginBottom: 10 },
  field: { marginBottom: 8 },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 10 },
  input: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '700', paddingVertical: 8 },
  suffix: { color: C.muted, fontWeight: '700' },
  result: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line },
  rLabel: { color: C.txt, fontSize: 14 },
  rValue: { color: C.gold, fontWeight: '900', fontSize: 15 },
});

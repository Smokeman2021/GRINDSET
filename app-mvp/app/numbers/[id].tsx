import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../../src/components/Button';
import { analyze, breakEvenCpl, totalsOf } from '../../src/data/advice';
import { askPermission } from '../../src/notifications';
import { useStore } from '../../src/store';
import { C } from '../../src/theme';

const num = (s: string) => {
  const v = parseFloat(s.replace(',', '.'));
  return Number.isFinite(v) ? v : 0;
};
const money = (v: number) => (Number.isFinite(v) ? `${v < 0 ? '−' : ''}$${Math.abs(v).toFixed(2)}` : '—');
const pct = (v: number) => (Number.isFinite(v) ? `${v.toFixed(1)}%` : '—');

function dstr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function shift(date: string, by: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + by);
  return dstr(d);
}

const REMIND: { label: string; times: string[] }[] = [
  { label: 'Без нагадувань', times: [] },
  { label: '2 рази: 11:00, 19:00', times: ['11:00', '19:00'] },
  { label: '4 рази: 10, 13, 16, 19', times: ['10:00', '13:00', '16:00', '19:00'] },
];

export default function CampaignScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { campaigns, saveEntry, addChange, updateCampaign, removeCampaign } = useStore();
  const c = campaigns.find((x) => x.id === id);

  const [date, setDate] = useState(dstr(new Date()));
  const [spend, setSpend] = useState('');
  const [impr, setImpr] = useState('');
  const [clicks, setClicks] = useState('');
  const [leads, setLeads] = useState('');
  const [change, setChange] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // при зміні дати підставляємо збережені значення
  useEffect(() => {
    const e = c?.entries.find((x) => x.date === date);
    setSpend(e ? String(e.spend) : '');
    setImpr(e ? String(e.impressions) : '');
    setClicks(e ? String(e.clicks) : '');
    setLeads(e ? String(e.leads) : '');
  }, [date, c?.entries.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const totals = useMemo(() => (c ? totalsOf(c) : null), [c]);
  const advice = useMemo(() => (c ? analyze(c) : []), [c]);

  if (!c || !totals) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 40 }]}>
        <Text style={styles.title}>Кампанію не знайдено</Text>
        <Button title="Назад" onPress={() => router.replace('/numbers')} />
      </View>
    );
  }

  const be = breakEvenCpl(c);
  const today = dstr(new Date());

  const save = () => {
    saveEntry(c.id, { date, spend: num(spend), impressions: num(impr), clicks: num(clicks), leads: num(leads) });
  };

  const setReminders = async (times: string[]) => {
    if (times.length) await askPermission();
    updateCampaign(c.id, { remindTimes: times });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.head, { paddingTop: insets.top + 10 }]}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.x}>←</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {c.name}
        </Text>
        <Pressable onPress={() => updateCampaign(c.id, { status: c.status === 'active' ? 'paused' : 'active' })}>
          <Text style={[styles.status, { color: c.status === 'active' ? C.accent : C.muted }]}>{c.status === 'active' ? 'Активна' : 'Пауза'}</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.card}>
          <Text style={styles.cTitle}>Підсумок</Text>
          <Row k="Витрати" v={money(totals.spend)} />
          <Row k="Ліди" v={String(totals.leads)} />
          <Row k="CPL" v={money(totals.cpl)} tone={Number.isFinite(totals.cpl) ? (totals.cpl <= be ? 'good' : 'bad') : undefined} />
          <Row k="Беззбитковий CPL" v={money(be)} tone="gold" />
          <Row k="Прибуток" v={money(totals.profit)} tone={totals.spend > 0 ? (totals.profit >= 0 ? 'good' : 'bad') : undefined} />
          <Row k="ROI" v={pct(totals.roi)} />
          <Row k="CTR" v={pct(totals.ctr)} />
          <Row k="CPC" v={money(totals.cpc)} />
          <Row k="CPM" v={money(totals.cpm)} />
          <Row k="CR (клік → лід)" v={pct(totals.cr)} />
        </View>

        <View style={styles.card}>
          <Text style={styles.cTitle}>Поради за правилами курсу</Text>
          {advice.map((a, i) => (
            <View key={i} style={[styles.advice, a.level === 'bad' && styles.aBad, a.level === 'warn' && styles.aWarn, a.level === 'good' && styles.aGood]}>
              <Text style={styles.aTxt}>{a.text}</Text>
            </View>
          ))}
          <Text style={styles.small}>Орієнтири залежать від ніші й гео. Це підказка, а не гарантія.</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cTitle}>Записати день</Text>
          <View style={styles.dateRow}>
            <Pressable onPress={() => setDate(shift(date, -1))} style={styles.dateBtn}>
              <Text style={styles.dateBtnTxt}>‹</Text>
            </Pressable>
            <Text style={styles.date}>{date === today ? `Сьогодні, ${date}` : date}</Text>
            <Pressable onPress={() => date < today && setDate(shift(date, 1))} style={[styles.dateBtn, date >= today && { opacity: 0.3 }]}>
              <Text style={styles.dateBtnTxt}>›</Text>
            </Pressable>
          </View>
          <Field label="Витрати, $" value={spend} onChange={setSpend} />
          <Field label="Покази" value={impr} onChange={setImpr} />
          <Field label="Кліки" value={clicks} onChange={setClicks} />
          <Field label="Ліди" value={leads} onChange={setLeads} />
          <View style={{ marginTop: 10 }}>
            <Button title="Зберегти день" onPress={save} />
          </View>
        </View>

        {c.entries.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cTitle}>Останні дні</Text>
            {[...c.entries].reverse().slice(0, 7).map((e) => {
              const cpl = e.leads > 0 ? e.spend / e.leads : NaN;
              return (
                <Pressable key={e.date} onPress={() => setDate(e.date)} style={styles.dayRow}>
                  <Text style={styles.dayDate}>{e.date.slice(5)}</Text>
                  <Text style={styles.dayTxt}>
                    {money(e.spend)} · {e.leads} лідів · CPL {money(cpl)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cTitle}>Журнал змін</Text>
          <Text style={styles.small}>Що змінив у кампанії і чому: бюджет, креатив, аудиторія, розклад.</Text>
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={change}
            onChangeText={setChange}
            placeholder="Наприклад: бюджет +20%, бо CPL нижче беззбиткового"
            placeholderTextColor={C.muted}
            multiline
          />
          <View style={{ marginTop: 8 }}>
            <Button
              title="Додати запис"
              disabled={!change.trim()}
              onPress={() => {
                addChange(c.id, change);
                setChange('');
              }}
            />
          </View>
          {c.changes.slice(0, 10).map((ch) => (
            <View key={ch.ts} style={styles.change}>
              <Text style={styles.changeDate}>{new Date(ch.ts).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</Text>
              <Text style={styles.changeTxt}>{ch.text}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cTitle}>Нагадування перевірити кабінет</Text>
          {REMIND.map((r) => {
            const on = JSON.stringify(c.remindTimes) === JSON.stringify(r.times);
            return (
              <Pressable key={r.label} onPress={() => setReminders(r.times)} style={[styles.opt, on && styles.optOn]}>
                <Text style={[styles.optTxt, on && { color: '#05140a' }]}>{r.label}</Text>
              </Pressable>
            );
          })}
          <Text style={styles.small}>Правило з курсу: заглядати в кабінет кожні 1–2 години в активні години й перевіряти білінг двічі на день.</Text>
        </View>

        <Pressable
          onPress={() => {
            if (confirmDel) {
              removeCampaign(c.id);
              router.replace('/numbers');
            } else setConfirmDel(true);
          }}
          style={{ marginTop: 20, alignItems: 'center' }}
        >
          <Text style={{ color: C.red, fontWeight: '800' }}>{confirmDel ? '⚠️ Натисни ще раз: видалити кампанію' : '🗑 Видалити кампанію'}</Text>
        </Pressable>
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

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ marginTop: 8 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={onChange} keyboardType="decimal-pad" placeholder="0" placeholderTextColor={C.muted} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingBottom: 12, borderBottomColor: C.line, borderBottomWidth: 1 },
  x: { color: C.txt, fontSize: 24, fontWeight: '800' },
  title: { color: C.txt, fontSize: 17, fontWeight: '900', flex: 1 },
  status: { fontWeight: '800', fontSize: 13 },
  card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  cTitle: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 8, textTransform: 'uppercase' },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.line },
  k: { color: C.txt, fontSize: 14, flex: 1 },
  v: { color: C.txt, fontWeight: '900', fontSize: 15 },
  small: { color: C.muted, fontSize: 12, lineHeight: 17, marginTop: 8 },
  advice: { borderRadius: 10, padding: 10, marginBottom: 8, backgroundColor: C.panel2, borderLeftWidth: 4, borderLeftColor: C.blue },
  aBad: { borderLeftColor: C.red },
  aWarn: { borderLeftColor: C.gold },
  aGood: { borderLeftColor: C.accent },
  aTxt: { color: C.txt, fontSize: 14, lineHeight: 20 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dateBtn: { width: 40, height: 36, borderRadius: 10, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
  dateBtnTxt: { color: C.txt, fontSize: 22, fontWeight: '900' },
  date: { color: C.txt, fontWeight: '800', fontSize: 15 },
  label: { color: C.muted, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  input: { backgroundColor: C.panel2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, color: C.txt, fontSize: 16, fontWeight: '700' },
  dayRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.line },
  dayDate: { color: C.gold, fontWeight: '800', width: 48 },
  dayTxt: { color: C.txt, flex: 1 },
  change: { marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: C.line },
  changeDate: { color: C.muted, fontSize: 11 },
  changeTxt: { color: C.txt, fontSize: 14, marginTop: 2, lineHeight: 20 },
  opt: { paddingVertical: 10, paddingHorizontal: 12, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2, marginBottom: 8 },
  optOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
  optTxt: { color: C.txt, fontWeight: '800' },
});

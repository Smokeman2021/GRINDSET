// Адмінка закритого тесту: відгуки тестерів, список тестерів, видача кодів, блокування, вивантаження в CSV.
// Бачить лише адмін (is_admin). Це лише зручність інтерфейсу: справжню перевірку робить сервер (RLS і функції is_admin_user).
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Theme, useStyles, useTheme } from '../src/theme';
import { Glow } from '../src/components/Glow';
import { getBackend } from '../src/cloud/backend';
import { useCloud } from '../src/cloud/cloudStore';
import { toCsv } from '../src/cloud/shared/csv';
import { summarizeEvents } from '../src/cloud/shared/analytics';
import { copyText, saveCsv, saveText } from '../src/cloud/exportFile';
import type { EventRow, FeedbackRow, FeedbackStatus, TesterRow } from '../src/cloud/types';
import { FEEDBACK_CSV_HEADER, STATUS_LABEL as FB_STATUS, contextLine, contributors, feedbackCsvRows, kindIcon, kindLabel, queueMarkdown } from '../src/cloud/shared/feedbackQueue';

const fmt = (ms: number | null) => (ms ? new Date(ms).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—');
const STATUS_LABEL: Record<TesterRow['status'], string> = { invited: 'запрошений', active: 'активний', blocked: 'заблокований' };
const ERR: Record<string, string> = {
  already_exists: 'Такий нік уже є.',
  bad_username: 'Нік: 3–32 символи, лише латиниця, цифри й _.',
  forbidden: 'Немає прав адміна.',
  cannot_change_self: 'Себе змінювати не можна.',
  user_not_found: 'Тестера не знайдено.',
};

export default function Admin() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const me = useCloud((c) => c.user);
  const [tab, setTab] = useState<'feedback' | 'testers' | 'events' | 'team'>('feedback');
  const [onlyQueue, setOnlyQueue] = useState(false);
  const [notes, setNotes] = useState<Record<number, string>>({}); // чернетки поміток власника
  const [feedback, setFeedback] = useState<FeedbackRow[] | null>(null);
  const [testers, setTesters] = useState<TesterRow[] | null>(null);
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ username: string; code: string } | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null); // «key» кнопки, що чекає другого натискання
  const [nick, setNick] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);

  const fail = useCallback((e: unknown) => {
    const m = e instanceof Error ? e.message : 'error';
    if (m === 'replaced') void useCloud.getState().verify();
    else setMsg(ERR[m] ?? 'Не вдалося. Перевір інтернет і спробуй ще раз.');
  }, []);

  const load = useCallback(async () => {
    const backend = getBackend();
    if (!backend || !me?.isAdmin) return;
    setLoading(true);
    setMsg(null);
    try {
      const [f, t, e] = await Promise.all([backend.adminFeedback(), backend.adminTesters(), backend.adminEvents()]);
      setFeedback(f);
      setTesters(t);
      setEvents(e);
    } catch (e) {
      fail(e);
    } finally {
      setLoading(false);
    }
  }, [me?.isAdmin, fail]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  // дія з двома натисканнями для небезпечного (нова видача коду скасовує старий, блокування вибиває з сеансу)
  const twoStep = (key: string, run: () => Promise<void>) => async () => {
    if (confirm !== key) return setConfirm(key);
    setConfirm(null);
    setMsg(null);
    try {
      await run();
      await load();
    } catch (e) {
      fail(e);
    }
  };

  const issue = (t: TesterRow) =>
    twoStep(`code:${t.id}`, async () => {
      const code = await getBackend()!.adminIssueInvite(t.username);
      setCopied(false);
      setIssued({ username: t.username, code });
    });

  const toggleBlock = (t: TesterRow) => twoStep(`blk:${t.id}`, () => getBackend()!.adminSetStatus(t.id, t.status === 'blocked' ? 'active' : 'blocked'));

  const add = async () => {
    setMsg(null);
    try {
      await getBackend()!.adminAddTester(nick, name);
      setNick('');
      setName('');
      await load();
    } catch (e) {
      fail(e);
    }
  };

  const review = async (f: FeedbackRow, patch: { note?: string; status?: FeedbackStatus; useful?: boolean }) => {
    setMsg(null);
    try {
      await getBackend()!.adminFeedbackReview(f.id, patch.note ?? f.note ?? '', patch.status ?? f.status ?? 'new', patch.useful ?? !!f.useful);
      setFeedback((list) => (list ?? []).map((x) => (x.id === f.id ? { ...x, note: patch.note ?? x.note, status: patch.status ?? x.status, useful: patch.useful ?? x.useful } : x)));
    } catch (e) {
      if (e instanceof Error && e.message === 'not_ready') setMsg('Помітки запрацюють після міграції 0008 (вікно викладки).');
      else fail(e);
    }
  };

  // Черга «в черзі для Claude» → Markdown для Ревізора: відгук, контекст, помітка власника
  const exportQueue = () => saveText('grindset-queue-for-claude.md', queueMarkdown(feedback ?? []), 'text/markdown');

  const exportFeedback = () =>
    saveCsv(
      'grindset-feedback.csv',
      toCsv(FEEDBACK_CSV_HEADER, feedbackCsvRows(feedback ?? []))
    );

  const exportTesters = () =>
    saveCsv(
      'grindset-testers.csv',
      toCsv(
        ['нік', 'імʼя', 'статус', 'адмін', 'останній вхід', 'код виданий'],
        (testers ?? []).map((t) => [t.username, t.name, STATUS_LABEL[t.status], t.isAdmin ? 'так' : 'ні', t.lastLoginAt ? new Date(t.lastLoginAt).toISOString() : '', t.inviteIssuedAt ? new Date(t.inviteIssuedAt).toISOString() : ''])
      )
    );

  const stats = React.useMemo(() => summarizeEvents(events ?? []), [events]);

  const exportEvents = () =>
    saveCsv(
      'grindset-events.csv',
      toCsv(
        ['id', 'час', 'нік', 'подія', 'урок', 'крок', 'всього кроків', 'збірка'],
        (events ?? []).map((e) => [e.id, new Date(e.createdAt).toISOString(), e.username, e.name, String(e.props?.lesson ?? ''), e.props?.step as number | undefined, e.props?.total as number | undefined, e.build])
      )
    );

  const body = !me?.isAdmin ? (
    <View style={styles.box}>
      <Text style={styles.boxTxt}>Цей екран лише для адміна.</Text>
    </View>
  ) : (
    <>
      {/* вкладки в один рядок без перенесення підписів; на вузькому екрані — горизонтальна прокрутка (ТЗ 006, 4.3) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
        {(
          [
            ['feedback', `Відгуки${feedback ? ` ${feedback.length}` : ''}`],
            ['testers', `Тестери${testers ? ` ${testers.length}` : ''}`],
            ['events', 'Події'],
            ['team', 'Внесок'],
          ] as const
        ).map(([k, label]) => (
          <Pressable key={k} onPress={() => setTab(k)} style={[styles.tab, tab === k && styles.tabOn]} accessibilityRole="tab" accessibilityState={{ selected: tab === k }}>
            <Text numberOfLines={1} style={[styles.tabTxt, tab === k && { color: C.onAccent }]}>
              {label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {msg && <Text style={styles.err}>{msg}</Text>}
      {loading && <ActivityIndicator color={C.accent} style={{ marginVertical: 12 }} />}

      {issued && (
        <View style={styles.codeBox}>
          <Text style={styles.codeHead}>Код для @{issued.username}</Text>
          <Text selectable style={styles.code}>
            {issued.code}
          </Text>
          <Text style={styles.sub}>Показується один раз: у базі лишається лише хеш. Старий код цього тестера вже не діє.</Text>
          <View style={styles.rowBtns}>
            <Pressable onPress={async () => setCopied(await copyText(issued.code))} style={styles.small}>
              <Text style={styles.smallTxt}>{copied ? '✓ Скопійовано' : 'Копіювати'}</Text>
            </Pressable>
            <Pressable onPress={() => setIssued(null)} style={styles.small}>
              <Text style={styles.smallTxt}>Сховати</Text>
            </Pressable>
          </View>
        </View>
      )}

      {tab === 'feedback' && (
        <>
          <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
            <Pressable onPress={() => setOnlyQueue((v) => !v)} style={[styles.export, onlyQueue && { borderColor: C.accent }]}>
              <Text style={styles.smallTxt}>{onlyQueue ? '☑' : '☐'} Лише «в черзі для Claude» · {(feedback ?? []).filter((f) => f.status === 'queued').length}</Text>
            </Pressable>
            <Pressable onPress={() => void exportQueue()} disabled={!feedback?.some((f) => f.status === 'queued')} style={[styles.export, !feedback?.some((f) => f.status === 'queued') && { opacity: 0.5 }]}>
              <Text style={styles.smallTxt}>⬇ Черга для Claude (Markdown)</Text>
            </Pressable>
            <Pressable onPress={() => void exportFeedback()} disabled={!feedback?.length} style={[styles.export, !feedback?.length && { opacity: 0.5 }]}>
              <Text style={styles.smallTxt}>⬇ Усі відгуки (CSV)</Text>
            </Pressable>
          </View>
          {feedback && feedback.length === 0 && (
            <View style={styles.box}>
              <Text style={styles.boxTxt}>Відгуків поки нема.</Text>
            </View>
          )}
          {(feedback ?? []).filter((f) => !onlyQueue || f.status === 'queued').map((f) => (
            <View key={f.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  {kindIcon(f.kind)} {kindLabel(f.kind)} · @{f.username}
                  {f.useful ? ' · ⭐' : ''}
                </Text>
                <Text style={styles.sub}>{fmt(f.createdAt)}</Text>
              </View>
              <Text style={styles.sub}>{contextLine(f)}</Text>
              <Text selectable style={styles.fbBody}>
                {f.body}
              </Text>
              {/* помітка власника, статус черги, «корисний» — тестер цього не бачить */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                {(['new', 'queued', 'done', 'skip'] as FeedbackStatus[]).map((st) => (
                  <Pressable key={st} onPress={() => void review(f, { status: st })} style={[styles.fbChip, (f.status ?? 'new') === st && styles.fbChipOn]}>
                    <Text style={[styles.fbChipTxt, (f.status ?? 'new') === st && { color: C.onAccent }]}>{FB_STATUS[st]}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => void review(f, { useful: !f.useful })} style={[styles.fbChip, f.useful && styles.fbChipOn]}>
                  <Text style={[styles.fbChipTxt, f.useful && { color: C.onAccent }]}>⭐ Корисний</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                <TextInput
                  value={notes[f.id] ?? f.note ?? ''}
                  onChangeText={(t) => setNotes((n) => ({ ...n, [f.id]: t.slice(0, 2000) }))}
                  placeholder="Помітка власника (бачиш лише ти)"
                  placeholderTextColor={C.muted}
                  style={[styles.input, { flex: 1 }]}
                />
                {notes[f.id] != null && notes[f.id] !== (f.note ?? '') && (
                  <Pressable onPress={() => void review(f, { note: notes[f.id] })} style={styles.fbChip}>
                    <Text style={styles.fbChipTxt}>Зберегти</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      {tab === 'team' && (
        <>
          <Text style={styles.sub}>Внесок тестерів: число відгуків і позначених корисними. Бачиш лише ти.</Text>
          {contributors(feedback ?? []).map((c) => (
            <View key={c.username} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>@{c.username}</Text>
                <Text style={styles.sub}>{fmt(c.lastAt)}</Text>
              </View>
              <Text style={styles.sub}>
                Відгуків: {c.total} · корисних: {c.useful}
              </Text>
            </View>
          ))}
          {feedback && feedback.length === 0 && (
            <View style={styles.box}>
              <Text style={styles.boxTxt}>Відгуків поки нема.</Text>
            </View>
          )}
        </>
      )}

      {tab === 'events' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Усього</Text>
            <Text style={styles.sub}>
              Подій: {stats.events} · тестерів з подіями: {stats.users} · відкриттів застосунку: {stats.sessions}
            </Text>
            {(events?.length ?? 0) >= 5000 && <Text style={styles.sub}>Показано останні 5000 подій.</Text>}
          </View>
          <Pressable onPress={() => void exportEvents()} disabled={!events?.length} style={[styles.export, !events?.length && { opacity: 0.5 }]}>
            <Text style={styles.smallTxt}>⬇ Вивантажити події (CSV)</Text>
          </Pressable>
          {stats.lessons.length === 0 && (
            <View style={styles.box}>
              <Text style={styles.boxTxt}>Подій з уроків поки нема.</Text>
            </View>
          )}
          {stats.lessons.map((l) => (
            <View key={l.lesson} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>Урок {l.lesson}</Text>
                <Text style={[styles.chip, { color: C.accentTxt }]}>{l.completion == null ? '—' : `${l.completion}% дійшли до кінця`}</Text>
              </View>
              <Text style={styles.sub}>
                почали {l.starts} · завершили {l.completes} · вийшли {l.exits}
                {l.avgExitStep != null ? ` · у середньому на кроці ${l.avgExitStep}` : ''}
              </Text>
            </View>
          ))}
        </>
      )}

      {tab === 'testers' && (
        <>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Додати тестера</Text>
            <TextInput value={nick} onChangeText={setNick} placeholder="@нік (латиниця, цифри, _)" placeholderTextColor={C.muted} autoCapitalize="none" autoCorrect={false} style={styles.input} />
            <TextInput value={name} onChangeText={setName} placeholder="Імʼя (необовʼязково)" placeholderTextColor={C.muted} style={styles.input} />
            <Pressable onPress={() => void add()} disabled={nick.trim().length < 3} style={[styles.primary, nick.trim().length < 3 && { opacity: 0.5 }]}>
              <Text style={[styles.smallTxt, { color: C.onAccent }]}>Додати</Text>
            </Pressable>
            <Text style={styles.sub}>Після додавання натисни «Видати код» і передай код тестеру приватно.</Text>
          </View>

          <Pressable onPress={() => void exportTesters()} disabled={!testers?.length} style={[styles.export, !testers?.length && { opacity: 0.5 }]}>
            <Text style={styles.smallTxt}>⬇ Вивантажити тестерів (CSV)</Text>
          </Pressable>

          {(testers ?? []).map((t) => (
            <View key={t.id} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>
                  @{t.username}
                  {t.isAdmin ? ' · адмін' : ''}
                </Text>
                <Text style={[styles.chip, t.status === 'blocked' && { color: C.redTxt }, t.status === 'active' && { color: C.accentTxt }]}>{STATUS_LABEL[t.status]}</Text>
              </View>
              <Text style={styles.sub}>
                {t.name} · вхід: {fmt(t.lastLoginAt)} · код: {fmt(t.inviteIssuedAt)}
              </Text>
              <View style={styles.rowBtns}>
                <Pressable onPress={issue(t)} style={styles.small}>
                  <Text style={styles.smallTxt}>{confirm === `code:${t.id}` ? 'Точно? Старий код скасується' : '🔑 Видати код'}</Text>
                </Pressable>
                {!t.isAdmin && (
                  <Pressable onPress={toggleBlock(t)} style={styles.small}>
                    <Text style={[styles.smallTxt, t.status !== 'blocked' && { color: C.redTxt }]}>
                      {confirm === `blk:${t.id}` ? 'Точно?' : t.status === 'blocked' ? '✅ Розблокувати' : '⛔ Заблокувати'}
                    </Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))}
        </>
      )}

      <Pressable onPress={() => void load()} style={styles.refresh}>
        <Text style={styles.smallTxt}>{loading ? 'Оновлюємо…' : '↻ Оновити'}</Text>
      </Pressable>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 30 }}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>🛠 Адмінка тестів</Text>
        {body}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    back: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 6 },
    backTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 15 },
    title: { color: C.txt, fontSize: 22, fontWeight: '900', marginBottom: 12 },
    tabsScroll: { flexGrow: 0, marginBottom: 12 },
    tabs: { flexDirection: 'row', gap: 8, flexGrow: 1 },
    tab: { flexGrow: 1, flexShrink: 0, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel2 },
    tabOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    tabTxt: { color: C.txt, fontWeight: '800', fontSize: 14 },
    box: { marginTop: 8, backgroundColor: C.panel2, borderRadius: 14, padding: 14, borderWidth: 2, borderColor: C.line },
    boxTxt: { color: C.txt, textAlign: 'center', fontWeight: '600' },
    err: { color: C.redTxt, fontWeight: '700', fontSize: 13, marginBottom: 8 },
    card: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, padding: 12, marginBottom: 8 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
    cardTitle: { color: C.txt, fontWeight: '800', fontSize: 15, flexShrink: 1 },
    sub: { color: C.muted, fontSize: 12, lineHeight: 16, marginTop: 2 },
    chip: { color: C.muted, fontSize: 12, fontWeight: '800' },
    fbChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, backgroundColor: C.panel2 },
    fbChipOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    fbChipTxt: { color: C.txt, fontSize: 12, fontWeight: '800' },
    fbBody: { color: C.txt, fontSize: 14, lineHeight: 20, marginTop: 8 },
    input: { color: C.txt, backgroundColor: C.panel2, borderRadius: 10, borderWidth: 2, borderColor: C.line, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15, marginTop: 8 },
    primary: { alignItems: 'center', paddingVertical: 11, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.accentEdge, backgroundColor: C.accent, marginTop: 10, marginBottom: 6 },
    rowBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
    small: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 2, borderBottomWidth: 3, borderColor: C.line, backgroundColor: C.panel2 },
    smallTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
    export: { alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel, marginBottom: 10 },
    refresh: { alignSelf: 'center', marginTop: 12, paddingVertical: 10, paddingHorizontal: 18, borderRadius: 12, backgroundColor: C.panel, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
    codeBox: { backgroundColor: C.chip, borderRadius: 14, borderWidth: 2, borderColor: C.accent, padding: 14, marginBottom: 12 },
    codeHead: { color: C.muted, fontWeight: '800', fontSize: 12 },
    code: { color: C.txt, fontSize: 26, fontWeight: '900', letterSpacing: 2, marginVertical: 8 },
  });

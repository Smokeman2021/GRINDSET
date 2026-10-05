import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { askPermission } from '../src/notifications';
import { useT, LANG_LABEL, Lang } from '../src/i18n';
import { GOAL_LABEL, GOAL_XP, DailyGoal, useStore } from '../src/store';
import { cardShadow, Theme, useStyles, useTheme } from '../src/theme';
import { Glow } from '../src/components/Glow';
import { CHANGELOG, SHOW_BUILD, UI_BUILD, loadedAtLabel } from '../src/version';

const GOALS: DailyGoal[] = ['casual', 'regular', 'intense'];

// Усі налаштування застосунку в одному місці: профіль лишається про прогрес, а тут — вигляд, навчання, сповіщення.
export default function Settings() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStore();
  const t = useT();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const Seg = ({ on, onPress, children, sub }: { on: boolean; onPress: () => void; children: string; sub?: string }) => (
    <Pressable onPress={onPress} style={[styles.seg, on && styles.segOn]}>
      <Text style={[styles.segTxt, on && { color: C.onAccent }]}>{children}</Text>
      {sub ? <Text style={[styles.segSub, on && { color: C.onAccent }]}>{sub}</Text> : null}
    </Pressable>
  );

  const Row = ({ title, sub, value, onChange }: { title: string; sub: string; value: boolean; onChange: (v: boolean) => void }) => (
    <View style={styles.switchRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowTitle}>{title}</Text>
        <Text style={styles.sub}>{sub}</Text>
      </View>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: C.accent, false: C.line }} thumbColor="#fff" />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>←</Text>
        </Pressable>
        <Text style={styles.topTitle}>Налаштування</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40 }}>
        <Text style={styles.h}>ВИГЛЯД І МОВА</Text>
        <View style={styles.card}>
          <Text style={styles.label}>{t('theme')}</Text>
          <View style={styles.segRow}>
            {(['night', 'day'] as const).map((n) => (
              <Seg key={n} on={s.theme === n} onPress={() => s.setTheme(n)}>
                {t(n === 'night' ? 'themeNight' : 'themeDay')}
              </Seg>
            ))}
          </View>
          <Text style={styles.label}>{t('language')}</Text>
          <View style={styles.segRow}>
            {(['uk', 'en', 'ru'] as Lang[]).map((l) => (
              <Seg key={l} on={s.lang === l} onPress={() => s.setLang(l)}>
                {LANG_LABEL[l]}
              </Seg>
            ))}
          </View>
          <Text style={styles.sub}>{t('languageNote')}</Text>
        </View>

        <Text style={styles.h}>НАВЧАННЯ</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Ціль дня</Text>
          <View style={styles.segRow}>
            {GOALS.map((g) => (
              <Seg key={g} on={s.dailyGoal === g} onPress={() => s.setDailyGoal(g)} sub={`${GOAL_XP[g]} XP`}>
                {GOAL_LABEL[g]}
              </Seg>
            ))}
          </View>
          <Row title="Жорстка енергія" sub="Без 10 енергії нові уроки закриті. Повтори доступні завжди." value={s.strictEnergy} onChange={s.setStrictEnergy} />
        </View>

        <Text style={styles.h}>СПОВІЩЕННЯ І ЗВУК</Text>
        <View style={styles.card}>
          <Row
            title="Нагадування"
            sub="Зранку, ввечері та одне X2-вікно на 10 хвилин посеред дня."
            value={s.notifEnabled}
            onChange={async (v) => {
              if (v) await askPermission();
              s.setNotif({ notifEnabled: v });
            }}
          />
          {s.notifEnabled && (
            <View style={{ marginTop: 12 }}>
              <Text style={styles.sub}>Ранок</Text>
              <View style={styles.segRow}>
                {['07:00', '08:00', '09:00'].map((x) => (
                  <Seg key={x} on={s.notifMorning === x} onPress={() => s.setNotif({ notifMorning: x })}>
                    {x}
                  </Seg>
                ))}
              </View>
              <Text style={styles.sub}>Вечір</Text>
              <View style={styles.segRow}>
                {['19:00', '20:30', '22:00'].map((x) => (
                  <Seg key={x} on={s.notifEvening === x} onPress={() => s.setNotif({ notifEvening: x })}>
                    {x}
                  </Seg>
                ))}
              </View>
            </View>
          )}
          <View style={styles.divider} />
          <Row title="Звуки" sub="Коротка мелодія на правильну відповідь, помилку, корону й рівень." value={s.soundEnabled} onChange={s.setSoundEnabled} />
        </View>

        <Text style={styles.h}>МАРШРУТ І ТЕСТИ</Text>
        <View style={styles.card}>
          <Pressable onPress={() => router.push('/adapt')} style={styles.link}>
            <Text style={styles.linkTxt}>🎯 Підлаштувати курс</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => router.push('/plan')} style={styles.link}>
            <Text style={styles.linkTxt}>🗺️ Мій маршрут</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => router.push('/diagnostic')} style={styles.link}>
            <Text style={styles.linkTxt}>🧪 Діагностичний тест{s.diagnosticDone ? ' (пройдено)' : ''}</Text>
          </Pressable>
        </View>

        {SHOW_BUILD && (
        <>
        <Text style={styles.h}>ЩО НОВОГО (ДЛЯ РОЗРОБНИКА)</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Збірка {UI_BUILD} · завантажено о {loadedAtLabel()}</Text>
          <Text style={[styles.sub, { marginBottom: 8 }]}>Якщо номер не змінився після оновлення — перезапусти сервер "GRINDSET на телефон.bat" і натисни Reload у Expo Go.</Text>
          {CHANGELOG.map((c) => (
            <View key={c.build} style={{ marginTop: 6 }}>
              <Text style={styles.rowTitle}>Збірка {c.build} · {c.date}</Text>
              {c.items.map((it) => (
                <Text key={it} style={styles.sub}>• {it}</Text>
              ))}
            </View>
          ))}
        </View>
        </>
        )}

        <Text style={styles.h}>ПРО ЗАСТОСУНОК</Text>
        <View style={styles.card}>
          <Text style={styles.sub}>
            Навчальний контент про performance-маркетинг. Не фінансова порада і не гарантія доходу. Результати залежать від бюджету, ніші та виконання. Політики Meta змінюються: звіряйся з офіційною документацією.
          </Text>
        </View>

        <Text style={styles.h}>АКАУНТ</Text>
        <View style={styles.card}>
          <Pressable onPress={() => (s.pausedAt ? s.resumeAccount() : s.pauseAccount())} style={styles.link}>
            <Text style={styles.linkTxt}>{s.pausedAt ? '▶️ Відновити акаунт' : '⏸ Пауза акаунта'}</Text>
          </Pressable>
          <Text style={styles.sub}>
            {s.pausedAt
              ? 'Акаунт на паузі: нагадування вимкнені, стрік не згасає. Прогрес збережений.'
              : 'Нагадування вимикаються, стрік не згасає, поки ти не повернешся. Прогрес зберігається.'}
          </Text>
          <View style={styles.divider} />
          <Pressable onPress={() => (confirmDelete ? (setConfirmDelete(false), s.reset(), router.replace('/')) : setConfirmDelete(true))} style={styles.link}>
            <Text style={[styles.linkTxt, { color: C.redTxt }]}>
              {confirmDelete ? '⚠️ Натисни ще раз: видалити акаунт і всі дані' : '🗑 Видалити акаунт'}
            </Text>
          </Pressable>
          <Text style={styles.sub}>
            Стирає прогрес, ім’я, образ і налаштування на цьому пристрої. Акаунта на сервері поки немає, тож видаляти більше нічого.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 10, gap: 10 },
    back: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', ...cardShadow(C, 'sm') },
    backTxt: { color: C.txt, fontSize: 18, fontWeight: '900' },
    topTitle: { flex: 1, color: C.txt, fontSize: 18, fontWeight: '900', textAlign: 'center' },
    h: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 18, marginBottom: 8, marginLeft: 4 },
    card: { backgroundColor: C.panel, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: C.line, ...cardShadow(C, 'md') },
    label: { color: C.txt, fontWeight: '800', fontSize: 15, marginBottom: 8 },
    rowTitle: { color: C.txt, fontWeight: '800', fontSize: 15, marginBottom: 2 },
    sub: { color: C.muted, fontSize: 12, lineHeight: 16 },
    segRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
    seg: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2 },
    segOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    segTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
    segSub: { color: C.muted, fontSize: 11, marginTop: 2 },
    switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    divider: { height: 1, backgroundColor: C.line, marginVertical: 12 },
    link: { paddingVertical: 6 },
    linkTxt: { color: C.txt, fontWeight: '800', fontSize: 15 },
  });

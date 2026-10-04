import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { TopBar } from '../../src/components/TopBar';
import { Avatar } from '../../src/components/Avatar';
import { GrindykSay } from '../../src/components/GrindykSay';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { MemeCard } from '../../src/components/MemeCard';
import { MEMES } from '../../src/data/memes';
import { levelProgress, levelTitle } from '../../src/data/levels';
import { ALL_LESSONS, crownsCompleted } from '../../src/data/modules';
import { ARCHETYPES, ArchetypeId, avatarStage, avatarFrame } from '../../src/data/avatars';
import { CharacterAvatar } from '../../src/components/CharacterAvatar';
import { STAT_DEFS, STAT_MAX } from '../../src/data/stats';
import { useT } from '../../src/i18n';
import { say } from '../../src/data/phrases';
import { masteredCount } from '../../src/data/srs';
import { statsOf, useStore } from '../../src/store';
import { cardShadow, Theme, useStyles, useTheme } from '../../src/theme';
import { Glow } from '../../src/components/Glow';
import { UI_BUILD, loadedAtLabel } from '../../src/version';

function lessonTitle(id: string): string {
  if (id === 'mistakes') return 'Надолуження помилок';
  if (id === 'sim') return 'Симулятор кампанії';
  if (id === 'adsim') return 'Тренажер кабінету';
  if (id === 'practice') return 'Швидке тренування';
  const l = ALL_LESSONS.find((x) => x.id === id);
  return l ? `${l.code} ${l.title}` : id;
}

export default function Profile() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const s = useStore();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [talk, setTalk] = useState(() => say('profile'));
  const [genderFilter, setGenderFilter] = useState<'m' | 'f'>(s.archetype ? (s.archetype[0] as 'm' | 'f') : 'm');

  const prog = levelProgress(s.xp);
  const stats = statsOf(s);
  const acc = s.totalCorrect + s.totalErrors > 0 ? Math.round((s.totalCorrect / (s.totalCorrect + s.totalErrors)) * 100) : 0;
  const unlocked = useMemo(() => new Set(s.unlocked), [s.unlocked]);
  const stage = avatarStage(crownsCompleted(s.completed));
  const t = useT();

  // Фото стискаємо до 320 px і зберігаємо як data-uri: так воно переживає перезапуск і працює на вебі
  const pickPhoto = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8 });
      if (res.canceled || !res.assets?.[0]) return;
      const small = await ImageManipulator.manipulate(res.assets[0].uri).resize({ width: 320 }).renderAsync();
      const saved = await small.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
      if (saved.base64) s.setPlayerPhoto(`data:image/jpeg;base64,${saved.base64}`);
    } catch (e) {
      console.warn('Не вдалося вибрати фото', e);
    }
  };

  const saveName = () => {
    if (draft.trim()) s.setPlayerName(draft);
    setEditing(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <TopBar title={t('titleProfile')} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.hero}>
          <View style={styles.build}>
            <Text style={styles.buildTxt}>збірка {UI_BUILD} · {loadedAtLabel()}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.gear} hitSlop={10}>
            <Text style={styles.gearTxt}>⚙️</Text>
          </Pressable>
          <Pressable onPress={pickPhoto}>
            <Avatar photo={s.playerPhoto} name={s.playerName} frame={s.frame} size={104} />
            <View style={styles.badge}>
              <Text style={styles.badgeTxt}>{s.playerPhoto ? '✎' : '+'}</Text>
            </View>
          </Pressable>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={draft}
              onChangeText={setDraft}
              autoFocus
              maxLength={14}
              onSubmitEditing={saveName}
              onBlur={saveName}
              placeholder="Твій нік"
              placeholderTextColor={C.muted}
            />
          ) : (
            <Pressable
              onPress={() => {
                setDraft(s.playerName);
                setEditing(true);
              }}
            >
              <Text style={styles.name}>
                {s.playerName || 'Гравець'} <Text style={styles.edit}>✎</Text>
              </Text>
            </Pressable>
          )}
          <Text style={styles.lvl}>
            Lvl {s.level} — «{levelTitle(s.level)}»
          </Text>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${Math.round(prog.pct * 100)}%` }]} />
          </View>
          <Text style={styles.xpTxt}>{prog.need ? `${prog.have}/${prog.need} XP до наступного рівня` : 'Максимальний рівень'}</Text>
        </View>

        <GrindykSay text={talk.text} pose={talk.pose} height={100} onPress={() => setTalk(say('profile'))} />

        <Text style={styles.h}>ПЕРСОНАЖ · СТАДІЯ {stage}/10</Text>
        <View style={styles.charBox}>
          {s.archetype ? (
            <CharacterAvatar archetype={s.archetype} stage={stage} height={200} />
          ) : (
            <Text style={styles.empty}>Обери свій образ нижче</Text>
          )}
        </View>
        <View style={styles.genderRow}>
          {(['m', 'f'] as const).map((g) => (
            <Pressable key={g} onPress={() => setGenderFilter(g)} style={[styles.genderBtn, genderFilter === g && styles.goalOn]}>
              <Text style={[styles.goalTxt, genderFilter === g && { color: C.onAccent }]}>{g === 'm' ? '♂ Чоловічий' : '♀ Жіночий'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.archGrid}>
          {ARCHETYPES.filter((a) => a.gender === genderFilter).map((a) => {
            const f = avatarFrame(a.id, 1);
            const on = s.archetype === a.id;
            return (
              <Pressable key={a.id} onPress={() => s.setArchetype(a.id)} style={[styles.archCell, on && styles.archCellOn]}>
                <Image source={f.src} style={{ width: 48 * f.ratio, height: 48 }} resizeMode="contain" />
                <Text style={[styles.archLbl, on && { color: C.accentTxt }]} numberOfLines={1}>
                  {a.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.h}>
          ХАРАКТЕРИСТИКИ{s.statPoints > 0 ? ` · ${s.statPoints} очок` : ''}
        </Text>
        <View style={styles.box}>
          {STAT_DEFS.map((d) => {
            const v = s.stats[d.id] ?? 0;
            return (
              <Pressable
                key={d.id}
                disabled={s.statPoints <= 0 || v >= STAT_MAX}
                onPress={() => s.allocStat(d.id)}
                style={({ pressed }) => [styles.statRow, pressed && s.statPoints > 0 && { opacity: 0.7 }]}
              >
                <Text style={{ fontSize: 20 }}>{d.icon}</Text>
                <View style={{ flex: 1 }}>
                  <View style={styles.statHead}>
                    <Text style={styles.setLabel}>{d.label}</Text>
                    <Text style={styles.setSub}>{v}/{STAT_MAX}</Text>
                  </View>
                  <Text style={styles.setSub}>{d.desc}</Text>
                  <View style={styles.statBar}>
                    <View style={[styles.statFill, { width: `${(v / STAT_MAX) * 100}%` }]} />
                  </View>
                </View>
                {s.statPoints > 0 && v < STAT_MAX && (
                  <View style={styles.statPlus}>
                    <Text style={styles.statPlusTxt}>+</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.h}>СТАТИСТИКА</Text>
        <View style={styles.grid}>
          <StatBox label="Уроків" value={String(stats.lessons)} />
          <StatBox label="Точність" value={`${acc}%`} />
          <StatBox label="Стрік" value={`${s.streak} 🔥`} />
          <StatBox label="Ідеальних" value={String(s.perfectLessons)} />
          <StatBox label="Коїнів за час" value={String(s.totalCoinsEarned)} />
          <StatBox label="Корон" value={`${stats.crowns} 👑`} />
          <StatBox label="Засвоєно міцно" value={String(masteredCount(s.srs))} />
        </View>

        <Text style={styles.h}>НАДОЛУЖЕННЯ ПОМИЛОК</Text>
        <Pressable
          disabled={s.mistakes.length === 0}
          onPress={() => router.push('/lesson/mistakes')}
          style={({ pressed }) => [styles.mistakes, s.mistakes.length === 0 && { opacity: 0.6 }, pressed && { transform: [{ translateY: 2 }] }]}
        >
          <Text style={{ fontSize: 28 }}>🩹</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.mTitle}>{s.mistakes.length ? `До повторення: ${s.mistakes.length}` : 'Помилок нема'}</Text>
            <Text style={styles.mSub}>
              {s.mistakes.length ? 'Питання, у яких ти помилявся. Правильна відповідь прибирає їх зі списку.' : 'Роби уроки, а я збиратиму все, що йде не так.'}
            </Text>
          </View>
        </Pressable>

        <Text style={styles.h}>ДОСЯГНЕННЯ · {s.unlocked.length}/{ACHIEVEMENTS.length}</Text>
        <View style={styles.achGrid}>
          {ACHIEVEMENTS.map((a) => {
            const on = unlocked.has(a.id);
            return (
              <View key={a.id} style={[styles.ach, !on && { opacity: 0.4 }]}>
                <Text style={{ fontSize: 30 }}>{on ? a.icon : '🔒'}</Text>
                <Text style={styles.achTitle}>{a.title}</Text>
                <Text style={styles.achDesc}>{a.desc}</Text>
              </View>
            );
          })}
        </View>

        <Text style={styles.h}>КОЛЕКЦІЯ МЕМІВ · {MEMES.filter((m) => unlocked.has(m.unlockedBy)).length}/{MEMES.length}</Text>
        <View style={styles.memeGrid}>
          {MEMES.map((m) => (
            <View key={m.id} style={styles.memeCell}>
              <MemeCard meme={m} locked={!unlocked.has(m.unlockedBy)} />
            </View>
          ))}
        </View>

        <Text style={styles.h}>ІСТОРІЯ</Text>
        {s.history.length === 0 && <Text style={styles.empty}>Поки порожньо. Пройди перший урок.</Text>}
        {s.history.slice(0, 10).map((h, i) => (
          <View key={h.date + i} style={styles.hRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.hTitle} numberOfLines={1}>
                {lessonTitle(h.id)}
              </Text>
              <Text style={styles.hSub}>
                {new Date(h.date).toLocaleDateString('uk-UA')} · ✓{h.correct} ✗{h.errors}
              </Text>
            </View>
            <Text style={styles.hXp}>+{h.xp} XP</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  const styles = useStyles(makeStyles);
  return (
    <View style={styles.stat}>
      <Text style={styles.statVal}>{value}</Text>
      <Text style={styles.statLbl}>{label}</Text>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  hero: { alignItems: 'center', marginBottom: 6 },
  gear: { position: 'absolute', right: 0, top: 0, zIndex: 2, width: 42, height: 42, borderRadius: 21, backgroundColor: C.panel, borderWidth: 2, borderColor: C.line, alignItems: 'center', justifyContent: 'center', ...cardShadow(C, 'sm') },
  gearTxt: { fontSize: 20 },
  build: { position: 'absolute', left: 0, top: 4, zIndex: 2, backgroundColor: C.panel, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: C.line },
  buildTxt: { color: C.muted, fontSize: 10, fontWeight: '700' },
  badge: {
    position: 'absolute',
    right: -2,
    bottom: 2,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderBottomWidth: 4,
    borderBottomColor: C.accentEdge,
  },
  badgeTxt: { color: C.onAccent, fontSize: 18, fontWeight: '900', marginTop: -2 },
  name: { color: C.txt, fontWeight: '900', fontSize: 22, marginTop: 10 },
  edit: { color: C.muted, fontSize: 14 },
  nameInput: {
    color: C.txt,
    fontWeight: '800',
    fontSize: 20,
    marginTop: 10,
    minWidth: 140,
    textAlign: 'center',
    borderBottomWidth: 2,
    borderBottomColor: C.accent,
  },
  lvl: { color: C.goldTxt, fontWeight: '800', fontSize: 14, marginTop: 4, textAlign: 'center' },
  xpBar: { alignSelf: 'stretch', height: 12, borderRadius: 8, backgroundColor: C.track, overflow: 'hidden', marginTop: 12 },
  xpFill: { height: '100%', backgroundColor: C.blue, borderRadius: 8 },
  xpTxt: { color: C.muted, fontSize: 12, marginTop: 6 },
  h: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 22, marginBottom: 10 },
  charBox: { alignItems: 'center', justifyContent: 'center', minHeight: 210, marginBottom: 12 },
  genderRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  genderBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: C.panel2,
  },
  archGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  archCell: {
    width: '22%',
    flexGrow: 1,
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 12,
    paddingVertical: 8,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
    ...cardShadow(C, 'sm'),
  },
  archCellOn: { borderColor: C.accent, borderBottomColor: C.accentEdge },
  archLbl: { color: C.muted, fontSize: 10, marginTop: 4 },
  statRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  statHead: { flexDirection: 'row', justifyContent: 'space-between' },
  statBar: { height: 8, borderRadius: 6, backgroundColor: C.track, overflow: 'hidden', marginTop: 6 },
  statFill: { height: '100%', backgroundColor: C.blue, borderRadius: 6 },
  statPlus: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.accent,
    borderBottomWidth: 3,
    borderBottomColor: C.accentEdge,
  },
  statPlusTxt: { color: C.onAccent, fontWeight: '900', fontSize: 16, marginTop: -2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: {
    width: '31%',
    flexGrow: 1,
    backgroundColor: C.panel,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
  },
  statVal: { color: C.txt, fontWeight: '900', fontSize: 18 },
  statLbl: { color: C.muted, fontSize: 11, marginTop: 2 },
  mistakes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.red,
  },
  mTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  mSub: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  achGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  ach: {
    width: '48%',
    flexGrow: 1,
    backgroundColor: C.panel,
    borderRadius: 14,
    padding: 12,
    borderWidth: 2,
    borderColor: C.line,
  },
  achTitle: { color: C.txt, fontWeight: '800', fontSize: 13, marginTop: 4 },
  achDesc: { color: C.muted, fontSize: 11, marginTop: 2, lineHeight: 15 },
  memeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  memeCell: { width: '48%', flexGrow: 1 },
  empty: { color: C.muted, fontSize: 13 },
  hRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.panel,
    borderRadius: 12,
    padding: 12,
    marginBottom: 6,
  },
  hTitle: { color: C.txt, fontWeight: '700', fontSize: 14 },
  hSub: { color: C.muted, fontSize: 12, marginTop: 2 },
  hXp: { color: C.blueTxt, fontWeight: '800' },
  box: { backgroundColor: C.panel, borderRadius: 16, padding: 14, borderWidth: 2, borderColor: C.line, ...cardShadow(C, 'sm') },
  setLabel: { color: C.txt, fontWeight: '800', fontSize: 15, marginBottom: 8 },
  setSub: { color: C.muted, fontSize: 12, lineHeight: 16 },
  goalRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  goalBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: C.line,
    backgroundColor: C.panel2,
  },
  goalOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
  goalTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
  goalSub: { color: C.muted, fontSize: 11, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  link: { paddingVertical: 12 },
  linkTxt: { color: C.txt, fontWeight: '800', fontSize: 15 },
  disclaimer: { color: C.muted, fontSize: 12, lineHeight: 17, marginVertical: 6 },
});

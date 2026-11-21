import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TopBar } from '../../src/components/TopBar';
import { GrindykSay } from '../../src/components/GrindykSay';
import { CARDS, CATEGORIES, categoryFor, PRICES_AS_OF } from '../../src/data/library';
import { TERMS } from '../../src/data/glossary';
import { KB_KIND_LABEL, KB_SECTIONS, KB_STARTER, KB_TASKS, KB_VERTICALS, kbGet, kbList, labelText, type KbSection, type KbTask, type KbVertical } from '../../src/data/kb';
import { useStore } from '../../src/store';
import { ADS_MANAGER_TOUR } from '../../src/data/adsManagerTour';
import { BM_ADSMANAGER } from '../../src/data/bm/adsmanager';
import { Markdown } from '../../src/components/Markdown';
import { ScreenHotspot, hotspotFeedback } from '../../src/components/ScreenHotspot';
import { Calculators } from '../../src/components/Calculators';
import { Advisor } from '../../src/components/Advisor';
import { INCLUDE_RESTRICTED } from '../../src/data/restricted';
import { SHOW_MY_NUMBERS } from '../../src/flags';
import { say } from '../../src/data/phrases';
import { useT } from '../../src/i18n';
import { cardShadow, Theme, useStyles, useTheme } from '../../src/theme';
import { Glow } from '../../src/components/Glow';

// «База» (ТЗ 004, B5): пошук, розділи Гайди / Глосарій / Софт / Інструменти / Шаблони, фільтри за вертикаллю й задачею.
// Статті відкриваються окремим екраном /kb/<ID> (той самий ID відкривають урок, гілка й тренажер).
const TOOL_TABS = ['Калькулятори', 'Порадник', 'Рекламний кабінет'] as const;

export default function Library() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const t = useT();
  const lang = useStore((s) => s.lang);
  const params = useLocalSearchParams<{ cat?: string; section?: string }>();
  const [talk, setTalk] = useState(() => say('library'));
  const fromLink = params.cat ? categoryFor(params.cat) : undefined;
  const [section, setSection] = useState<KbSection>(fromLink ? 'software' : (params.section as KbSection) || 'guides');
  const [query, setQuery] = useState('');
  const [vertical, setVertical] = useState<KbVertical | null>(null);
  const [task, setTask] = useState<KbTask | null>(null);
  const [softCat, setSoftCat] = useState<string>(fromLink ?? 'Сервіси');
  const [toolTab, setToolTab] = useState<(typeof TOOL_TABS)[number]>('Калькулятори');
  const [open, setOpen] = useState<string | null>(null);
  const [bmPicked, setBmPicked] = useState<string | null>(null);
  const [tourOpen, setTourOpen] = useState(false);

  React.useEffect(() => {
    if (fromLink) {
      setSection('software');
      setSoftCat(fromLink);
    }
  }, [fromLink]);

  const q = query.trim();
  const searching = q.length > 0;
  const filtered = !!vertical || !!task;
  const softCats = useMemo(() => ['Сервіси', ...CATEGORIES.map((c) => c.id).filter((c) => CARDS.some((k) => k.category === c && (INCLUDE_RESTRICTED || !k.risky)))], []);
  const openArticle = (id: string) => router.push({ pathname: '/kb/[id]', params: { id } });

  // пошук іде по всіх розділах: статті «Бази», терміни глосарію, картки сервісів
  const lc = q.toLowerCase();
  const found = useMemo(() => (searching || filtered ? kbList(lang, { query: q, vertical, task, section: searching ? undefined : section === 'guides' || section === 'software' || section === 'templates' ? section : undefined }) : []), [lang, q, vertical, task, section, searching, filtered]);
  const foundTerms = searching ? TERMS.filter((x) => `${x.title} ${x.def}`.toLowerCase().includes(lc)) : [];
  const foundCards = searching ? CARDS.filter((k) => (INCLUDE_RESTRICTED || !k.risky) && `${k.name} ${k.forWhat} ${k.category}`.toLowerCase().includes(lc)) : [];
  const kbSection = section === 'guides' || section === 'software' || section === 'templates' ? kbList(lang, { section, vertical, task }) : [];

  const Row = ({ id, title, sub, labels }: { id: string; title: string; sub?: string; labels?: string[] }) => (
    <Pressable onPress={() => openArticle(id)} style={({ pressed }) => [styles.kbRow, pressed && { transform: [{ translateY: 2 }] }]} accessibilityRole="button">
      <Text style={styles.kbId}>{id}</Text>
      <Text style={styles.kbTitle}>{title}</Text>
      {!!sub && <Text style={styles.kbSub}>{sub}</Text>}
      {!!labels?.length && <Text style={styles.kbLabels}>{labels.map(labelText).join(' · ')}</Text>}
    </Pressable>
  );
  const kindOf = (k: string) => KB_KIND_LABEL[k as keyof typeof KB_KIND_LABEL];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <TopBar title={t('titleLibrary')} />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }} keyboardShouldPersistTaps="handled">
        <GrindykSay text={talk.text} pose={talk.pose} height={100} onPress={() => setTalk(say('library'))} />

        <TextInput value={query} onChangeText={setQuery} placeholder="Пошук: назва, текст або термін" placeholderTextColor="#8892a0" style={styles.search} accessibilityLabel="Пошук у Базі" />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8 }}>
          {KB_SECTIONS.map((s) => (
            <Pressable key={s.id} onPress={() => { setSection(s.id); setQuery(''); }} style={[styles.chip, !searching && section === s.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, !searching && section === s.id && { color: C.onAccent }]}>
                {s.icon} {s.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {(section === 'guides' || section === 'templates' || searching) && (
          <>
            <Text style={styles.filterHead}>Вертикаль</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {KB_VERTICALS.map((v) => (
                <Pressable key={v.id} onPress={() => setVertical(vertical === v.id ? null : v.id)} style={[styles.fchip, vertical === v.id && styles.fchipOn]}>
                  <Text style={[styles.fchipTxt, vertical === v.id && { color: C.onAccent }]}>{v.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={styles.filterHead}>Задача</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {KB_TASKS.map((x) => (
                <Pressable key={x.id} onPress={() => setTask(task === x.id ? null : x.id)} style={[styles.fchip, task === x.id && styles.fchipOn]}>
                  <Text style={[styles.fchipTxt, task === x.id && { color: C.onAccent }]}>{x.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </>
        )}

        <View style={{ height: 12 }} />

        {/* ───── результати пошуку (усі розділи) ───── */}
        {searching && (
          <>
            {found.map((a) => <Row key={a.id} id={a.id} title={a.title} sub={kindOf(a.kind)} labels={a.labels} />)}
            {foundTerms.map((x) => (
              <Pressable key={x.id} onPress={() => (x.article ? openArticle(x.article) : setOpen(open === `term-${x.id}` ? null : `term-${x.id}`))} style={styles.termRow}>
                <Text style={styles.termTitle}>🔤 {x.title}</Text>
                <Text style={styles.termDef}>{x.def}</Text>
              </Pressable>
            ))}
            {foundCards.map((k) => (
              <Pressable key={k.id} onPress={() => { setSection('software'); setSoftCat(k.category); setQuery(''); setOpen(k.id); }} style={styles.termRow}>
                <Text style={styles.termTitle}>🧰 {k.name}</Text>
                <Text style={styles.termDef}>{k.forWhat}</Text>
              </Pressable>
            ))}
            {found.length + foundTerms.length + foundCards.length === 0 && (
              <Text style={styles.empty}>Нічого не знайшли за «{q}». Спробуй коротше слово або термін (наприклад, «апрув», «когорта», «CPL»), прибери фільтри або відкрий «Стартову добірку» в розділі «Гайди».</Text>
            )}
          </>
        )}

        {/* ───── Гайди ───── */}
        {!searching && section === 'guides' && (
          <>
            {!filtered &&
              KB_STARTER.map((g) => (
                <View key={g.title} style={{ marginBottom: 6 }}>
                  <Text style={styles.groupHead}>⭐ {g.title}</Text>
                  {g.ids.map((id) => {
                    const a = kbGet(id, lang);
                    return a ? <Row key={id} id={id} title={a.title} sub={kindOf(a.kind)} labels={a.labels} /> : null;
                  })}
                </View>
              ))}
            <Text style={styles.groupHead}>{filtered ? `Знайдено: ${kbSection.length}` : 'Усі матеріали'}</Text>
            {kbSection.map((a) => <Row key={a.id} id={a.id} title={a.title} sub={kindOf(a.kind)} labels={a.labels} />)}
            {kbSection.length === 0 && <Text style={styles.empty}>За цими фільтрами матеріалів немає. Зніми фільтр задачі або вертикалі.</Text>}
          </>
        )}

        {/* ───── Шаблони ───── */}
        {!searching && section === 'templates' && (
          <>
            {kbSection.map((a) => <Row key={a.id} id={a.id} title={a.title} sub="Чекліст і шаблон" />)}
            {kbSection.length === 0 && <Text style={styles.empty}>За цими фільтрами шаблонів немає. Зніми фільтр.</Text>}
          </>
        )}

        {/* ───── Глосарій ───── */}
        {!searching && section === 'glossary' &&
          TERMS.map((x) => {
            const isOpen = open === `term-${x.id}`;
            return (
              <Pressable key={x.id} onPress={() => setOpen(isOpen ? null : `term-${x.id}`)} style={styles.termRow}>
                <View style={styles.head}>
                  <Text style={styles.termTitle}>{x.title}</Text>
                  <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
                </View>
                {isOpen && <Text style={styles.termDef}>{x.def}</Text>}
                {isOpen && x.article && (
                  <Pressable onPress={() => openArticle(x.article!)} style={styles.bmOpenAll}>
                    <Text style={styles.bmOpenAllTxt}>Відкрити статтю {x.article} →</Text>
                  </Pressable>
                )}
              </Pressable>
            );
          })}

        {/* ───── Софт: картки сервісів «Бази» + каталог із цінами ───── */}
        {!searching && section === 'software' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginBottom: 10 }}>
              {softCats.map((c) => (
                <Pressable key={c} onPress={() => setSoftCat(c)} style={[styles.fchip, softCat === c && styles.fchipOn]}>
                  <Text style={[styles.fchipTxt, softCat === c && { color: C.onAccent }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {softCat === 'Сервіси' && kbList(lang, { section: 'software' }).map((a) => <Row key={a.id} id={a.id} title={a.title} />)}
            {softCat !== 'Сервіси' &&
              CARDS.filter((k) => k.category === softCat && (INCLUDE_RESTRICTED || !k.risky)).map((k) => {
                const isOpen = open === k.id;
                return (
                  <Pressable key={k.id} onPress={() => setOpen(isOpen ? null : k.id)} style={styles.card}>
                    <View style={styles.head}>
                      <Text style={styles.name}>{k.name}</Text>
                      <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
                    </View>
                    <Text style={styles.forWhat}>{k.forWhat}</Text>
                    <Text style={styles.price}>💰 {k.price}</Text>
                    {isOpen && (
                      <View style={{ marginTop: 10 }}>
                        <Text style={styles.plus}>ТАРИФИ</Text>
                        {k.pricing.map((p) => (
                          <Text key={p} style={styles.li}>
                            • {p}
                          </Text>
                        ))}
                        {k.terms && <Text style={styles.terms}>Умови: {k.terms}</Text>}
                        <Text style={[styles.plus, { marginTop: 10 }]}>ПЛЮСИ</Text>
                        {k.pros.map((p) => (
                          <Text key={p} style={styles.li}>
                            + {p}
                          </Text>
                        ))}
                        <Text style={[styles.plus, { color: C.redTxt, marginTop: 8 }]}>МІНУСИ</Text>
                        {k.cons.map((p) => (
                          <Text key={p} style={styles.li}>
                            − {p}
                          </Text>
                        ))}
                      </View>
                    )}
                  </Pressable>
                );
              })}
            {softCat !== 'Сервіси' && <Text style={styles.foot}>Ціни зібрані з відкритих джерел станом на {PRICES_AS_OF} і часто змінюються: перед оплатою перевір сайт сервісу.</Text>}
          </>
        )}

        {/* ───── Інструменти ───── */}
        {!searching && section === 'tools' && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }} style={{ marginBottom: 10 }}>
              {TOOL_TABS.map((c) => (
                <Pressable key={c} onPress={() => setToolTab(c)} style={[styles.fchip, toolTab === c && styles.fchipOn]}>
                  <Text style={[styles.fchipTxt, toolTab === c && { color: C.onAccent }]}>{c}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {SHOW_MY_NUMBERS && (
              <Pressable onPress={() => router.push('/numbers')} style={({ pressed }) => [styles.numbers, pressed && { transform: [{ translateY: 2 }] }]}>
                <Text style={{ fontSize: 26 }}>📈</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.numbersTitle}>Мої цифри</Text>
                  <Text style={styles.numbersSub}>Трекер твоїх кампаній: дані, зміни, поради й нагадування перевірити результат.</Text>
                </View>
              </Pressable>
            )}
            {toolTab === 'Калькулятори' && <Calculators />}
            {toolTab === 'Порадник' && <Advisor />}
            {toolTab === 'Рекламний кабінет' && (
              <>
                <Pressable onPress={() => router.push('/adsim')} style={styles.simBtn}>
                  <Text style={{ fontSize: 24 }}>🕹️</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.simBtnTitle}>Тренажер кабінету</Text>
                    <Text style={styles.simBtnSub}>5 рішень від старту кампанії до публікації — клікабельно, з реакцією Гріндіка.</Text>
                  </View>
                </Pressable>
                <View style={styles.bmCard}>
                  <Text style={styles.simBtnTitle}>🗺️ Карта кабінету</Text>
                  <Text style={[styles.simBtnSub, { marginTop: 2, marginBottom: 10 }]}>Реальна карта рекламного кабінету. Навчися орієнтуватись до першого запуску.</Text>
                  <Text style={styles.simBtnSub}>{BM_ADSMANAGER[0].talk}</Text>
                  <Text style={[styles.simBtnTitle, { marginTop: 8, marginBottom: 8 }]}>{BM_ADSMANAGER[0].task}</Text>
                  <ScreenHotspot screen={BM_ADSMANAGER[0]} picked={bmPicked} onPick={setBmPicked} />
                  {bmPicked && <Text style={styles.bmFeedback}>{hotspotFeedback(BM_ADSMANAGER[0], bmPicked)}</Text>}
                  {bmPicked && (
                    <Pressable onPress={() => setBmPicked(null)} style={styles.bmReset}>
                      <Text style={styles.bmResetTxt}>Спробувати ще раз</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => router.push('/bm')} style={styles.bmOpenAll}>
                    <Text style={styles.bmOpenAllTxt}>Відкрити всю карту →</Text>
                  </Pressable>
                </View>
                <Pressable onPress={() => setTourOpen((o) => !o)} style={styles.accHead}>
                  <Text style={styles.simBtnTitle}>📚 Розбір екранів кабінету · {ADS_MANAGER_TOUR.length}</Text>
                  <Text style={styles.arrow}>{tourOpen ? '▲' : '▼'}</Text>
                </Pressable>
                {tourOpen &&
                  ADS_MANAGER_TOUR.map((s) => {
                    const isOpen = open === `ads-${s.id}`;
                    return (
                      <Pressable key={s.id} onPress={() => setOpen(isOpen ? null : `ads-${s.id}`)} style={styles.accRow}>
                        <View style={styles.head}>
                          <Text style={styles.accRowTitle}>{s.title}</Text>
                          <Text style={styles.arrow}>{isOpen ? '▲' : '▼'}</Text>
                        </View>
                        {isOpen && (
                          <View style={{ marginTop: 8 }}>
                            <Markdown text={s.body} small />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  bmOpenAll: { marginTop: 12, alignSelf: 'flex-start', paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel2 },
  bmOpenAllTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 13 },
  accHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 8 },
  accRow: { backgroundColor: C.panel2, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 4, marginLeft: 8 },
  accRowTitle: { color: C.txt, fontWeight: '700', fontSize: 13, flex: 1, paddingRight: 8 },
  tourIntro: { color: C.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },
  simBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.gold,
    borderBottomColor: C.goldEdge,
    ...cardShadow(C, 'sm'),
  },
  simBtnTitle: { color: C.txt, fontWeight: '900', fontSize: 15 },
  simBtnSub: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  bmCard: {
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 2,
    borderColor: C.blue,
    ...cardShadow(C, 'sm'),
  },
  bmTag: { color: C.blueTxt, fontWeight: '900', fontSize: 10, letterSpacing: 1, marginBottom: 6 },
  bmFeedback: { color: C.txt, fontSize: 13, lineHeight: 19, marginTop: 12, backgroundColor: C.panel2, borderRadius: 10, padding: 10 },
  bmReset: { alignSelf: 'center', marginTop: 10, paddingVertical: 8, paddingHorizontal: 16 },
  bmResetTxt: { color: C.blueTxt, fontWeight: '800', fontSize: 13 },
  termRow: { backgroundColor: C.panel, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 6, borderWidth: 2, borderColor: C.line, ...cardShadow(C, 'sm') },
  termTitle: { color: C.txt, fontWeight: '800', fontSize: 15, flex: 1 },
  terms: { color: C.goldTxt, fontSize: 12, lineHeight: 18, marginTop: 6 },
  termDef: { color: C.txt, fontSize: 14, lineHeight: 21, marginTop: 8 },
  numbers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.accent,
    borderBottomColor: C.accentEdge,
  },
  numbersTitle: { color: C.txt, fontWeight: '900', fontSize: 16 },
  numbersSub: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: C.panel,
    borderWidth: 2,
    borderColor: C.line,
  },
  chipOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
  chipTxt: { color: C.txt, fontWeight: '700', fontSize: 13 },
  card: {
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    marginBottom: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: C.txt, fontWeight: '900', fontSize: 17, flex: 1 },
  arrow: { color: C.muted, fontSize: 12 },
  forWhat: { color: C.txt, fontSize: 14, lineHeight: 20, marginTop: 6 },
  price: { color: C.goldTxt, fontWeight: '700', fontSize: 13, marginTop: 8 },
  plus: { color: C.accentTxt, fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  li: { color: C.txt, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  foot: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
  search: { borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11, color: C.txt, backgroundColor: C.panel, fontSize: 15, marginTop: 12 },
  filterHead: { color: C.muted, fontWeight: '800', fontSize: 11, letterSpacing: 0.8, marginTop: 10, marginBottom: 6 },
  fchip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 12, backgroundColor: C.panel2, borderWidth: 1.5, borderColor: C.line },
  fchipOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
  fchipTxt: { color: C.txt, fontWeight: '700', fontSize: 12 },
  groupHead: { color: C.txt, fontWeight: '900', fontSize: 15, marginTop: 10, marginBottom: 8 },
  kbRow: { backgroundColor: C.panel, borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line },
  kbId: { color: C.muted, fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  kbTitle: { color: C.txt, fontWeight: '800', fontSize: 15, marginTop: 2 },
  kbSub: { color: C.accentTxt, fontSize: 12, fontWeight: '700', marginTop: 2 },
  kbLabels: { color: C.goldTxt, fontSize: 11, marginTop: 4 },
  empty: { color: C.muted, fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 16, paddingHorizontal: 8 },
});

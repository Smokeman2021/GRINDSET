import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TopBar } from '../../src/components/TopBar';
import { HANDBOOK_VERTICALS, kbList, type KbArticle, type KbVertical } from '../../src/data/kb';
import { useStore } from '../../src/store';
import { Theme, useStyles, useTheme } from '../../src/theme';

const TABS = [
  { id: 'handbook', title: 'Посібник' },
  { id: 'glossary', title: 'Глосарій' },
  { id: 'templates', title: 'Шаблони' },
] as const;
type Tab = typeof TABS[number]['id'];

export default function Library() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const lang = useStore((state) => state.lang);
  const { section: requested } = useLocalSearchParams<{ section?: string }>();
  const [section, setSection] = useState<Tab>('handbook');
  const [query, setQuery] = useState('');
  const [vertical, setVertical] = useState<KbVertical | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    if (requested === 'glossary' || requested === 'templates' || requested === 'handbook') setSection(requested);
  }, [requested]);
  const searching = query.trim().length > 0;
  const articles = useMemo(() => kbList(lang, {
    section: searching ? undefined : section,
    vertical: section === 'handbook' || searching ? vertical : null,
    query,
    handbookOnly: true,
  }), [lang, query, searching, section, vertical]);
  const groups = useMemo(() => {
    const entries = new Map<string, { title: string; articles: KbArticle[] }>();
    for (const article of articles) {
      if (!article.handbook) continue;
      const { groupId, groupTitle } = article.handbook;
      const group = entries.get(groupId);
      if (group) group.articles.push(article);
      else entries.set(groupId, { title: groupTitle, articles: [article] });
    }
    return [...entries];
  }, [articles]);
  const expanded = openGroup === undefined ? groups[0]?.[0] : openGroup;

  function row(article: KbArticle) {
    return (
      <Pressable key={article.id} accessibilityRole="button" onPress={() => router.push({ pathname: '/kb/[id]', params: { id: article.id } })} style={styles.row}>
        {article.handbook?.sourceId && <Text style={styles.source}>{article.handbook.sourceId}</Text>}
        <Text style={styles.title}>{article.title}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.root}>
      <TopBar title="База" />
      <ScrollView contentContainerStyle={{ padding: 18, paddingBottom: insets.bottom + 28, gap: 13 }} keyboardShouldPersistTaps="handled">
        <TextInput value={query} onChangeText={setQuery} placeholder="Знайти тему або термін" placeholderTextColor={C.muted} style={styles.search} accessibilityLabel="Пошук у Базі" />
        <View style={styles.chips}>{TABS.map((tab) => (
          <Pressable key={tab.id} accessibilityRole="button" accessibilityState={{ selected: !searching && section === tab.id }} onPress={() => { setSection(tab.id); setQuery(''); setVertical(null); setOpenGroup(undefined); }} style={[styles.chip, !searching && section === tab.id && styles.selected]}>
            <Text style={styles.title}>{tab.title}</Text>
          </Pressable>
        ))}</View>
        {(section === 'handbook' || searching) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
            {[{ id: null, title: 'Усі теми' }, ...HANDBOOK_VERTICALS].map(({ id, title }) => (
              <Pressable key={id ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: vertical === id }} onPress={() => { setVertical(id); setOpenGroup(undefined); }} style={[styles.chip, vertical === id && styles.selected]}>
                <Text style={styles.filter}>{title}</Text>
              </Pressable>
            ))}
          </ScrollView>
        )}
        {!articles.length && <Text style={styles.filter}>За цим запитом нічого не знайдено.</Text>}
        {searching || section !== 'handbook' ? articles.map(row) : groups.map(([id, group]) => (
          <View key={id} style={styles.group}>
            <Pressable style={styles.groupHead} accessibilityRole="button" accessibilityState={{ expanded: expanded === id }} onPress={() => setOpenGroup(expanded === id ? null : id)}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              <Text style={styles.filter}>{expanded === id ? '−' : '+'}</Text>
            </Pressable>
            {expanded === id && group.articles.map(row)}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  search: { borderWidth: 1, borderColor: C.line, borderRadius: 12, backgroundColor: C.panel, color: C.txt, paddingHorizontal: 12, minHeight: 46, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filters: { flexDirection: 'row', gap: 8 },
  chip: { borderWidth: 1, borderColor: C.line, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  selected: { borderColor: C.accent, backgroundColor: C.accentTint },
  filter: { color: C.muted, fontSize: 13, fontWeight: '700' },
  title: { color: C.txt, fontSize: 14, fontWeight: '800' },
  group: { gap: 6 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: 12, backgroundColor: C.panel, borderWidth: 1, borderColor: C.line, borderRadius: 12 },
  groupTitle: { flex: 1, color: C.txt, fontSize: 16, fontWeight: '900' },
  row: { padding: 12, gap: 4, borderBottomWidth: 1, borderBottomColor: C.line, borderRadius: 8, backgroundColor: C.panel },
  source: { color: C.accentTxt, fontSize: 12, fontWeight: '800' },
});

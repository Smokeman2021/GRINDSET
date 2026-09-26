import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { TopBar } from '../../src/components/TopBar';
import { GrindykSay } from '../../src/components/GrindykSay';
import { CARDS, CATEGORIES, categoryFor } from '../../src/data/library';
import { TERMS } from '../../src/data/glossary';
import { Calculators } from '../../src/components/Calculators';
import { INCLUDE_RESTRICTED } from '../../src/data/restricted';
import { say } from '../../src/data/phrases';
import { C } from '../../src/theme';

export default function Library() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ cat?: string }>();
  const [talk, setTalk] = useState(() => say('library'));
  const cats = useMemo(
    () => [{ id: 'Калькулятори', icon: '🧮' }, { id: 'Словник', icon: '📖' }, ...CATEGORIES].filter((c) => c.id === 'Калькулятори' || c.id === 'Словник' || CARDS.some((k) => k.category === c.id && (INCLUDE_RESTRICTED || !k.risky))),
    []
  );
  const fromLink = params.cat ? categoryFor(params.cat) : undefined;
  const [cat, setCat] = useState<string>(fromLink ?? cats[0]?.id ?? '');
  const [open, setOpen] = useState<string | null>(null);

  React.useEffect(() => {
    if (fromLink) setCat(fromLink);
  }, [fromLink]);

  const cards = CARDS.filter((k) => k.category === cat && (INCLUDE_RESTRICTED || !k.risky));

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="БІБЛІОТЕКА" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <GrindykSay text={talk.text} pose={talk.pose} height={100} onPress={() => setTalk(say('library'))} />

        <Pressable onPress={() => router.push('/numbers')} style={({ pressed }) => [styles.numbers, pressed && { transform: [{ translateY: 2 }] }]}>
          <Text style={{ fontSize: 26 }}>📈</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.numbersTitle}>Мої цифри</Text>
            <Text style={styles.numbersSub}>Трекер твоїх кампаній: дані, зміни, поради й нагадування перевірити кабінет</Text>
          </View>
        </Pressable>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 12 }} contentContainerStyle={{ gap: 8 }}>
          {cats.map((c) => (
            <Pressable key={c.id} onPress={() => setCat(c.id)} style={[styles.chip, cat === c.id && styles.chipOn]}>
              <Text style={[styles.chipTxt, cat === c.id && { color: '#05140a' }]}>
                {c.icon} {c.id}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {cat === 'Калькулятори' && <Calculators />}

        {cat === 'Словник' &&
          TERMS.map((t) => (
            <View key={t.id} style={styles.card}>
              <Text style={styles.name}>{t.title}</Text>
              <Text style={styles.forWhat}>{t.def}</Text>
            </View>
          ))}

        {cards.map((k) => {
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
                  <Text style={styles.plus}>ПЛЮСИ</Text>
                  {k.pros.map((p) => (
                    <Text key={p} style={styles.li}>
                      + {p}
                    </Text>
                  ))}
                  <Text style={[styles.plus, { color: C.red, marginTop: 8 }]}>МІНУСИ</Text>
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

        <Text style={styles.foot}>
          Ціни й умови змінюються: перед оплатою перевір сайт сервісу. Інформація довідкова, не реклама і не порада.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  price: { color: C.gold, fontWeight: '700', fontSize: 13, marginTop: 8 },
  plus: { color: C.accent, fontWeight: '900', fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  li: { color: C.txt, fontSize: 13, lineHeight: 19, marginBottom: 2 },
  foot: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 12 },
});

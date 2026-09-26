import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { TopBar } from '../../src/components/TopBar';
import { GrindykSay } from '../../src/components/GrindykSay';
import { Icon } from '../../src/components/Icon';
import { ITEMS, ShopCategory, FRAMES } from '../../src/data/shop';
import { ENERGY_REGEN_MS, MAX_ENERGY, MAX_STREAK_FREEZES, useStore } from '../../src/store';
import { C } from '../../src/theme';
import { shopSay, ShopMsg } from '../../src/data/phrases';

const CATEGORIES: ShopCategory[] = ['Енергія', 'Захист', 'Бустери', 'Косметика'];

function fmtLeft(ms: number) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h} год ${m % 60} хв` : `${m} хв`;
}

export default function Shop() {
  const insets = useSafeAreaInsets();
  const { coins, energy, energyAt, streakFreezes, comboShields, hints, doubleCoins, frames, frame, buyItem, equipFrame, refreshEnergy } =
    useStore();
  const [talk, setTalk] = useState(() => shopSay('welcome'));

  useFocusEffect(
    React.useCallback(() => {
      refreshEnergy();
      setTalk(shopSay('welcome'));
    }, [refreshEnergy])
  );

  const owned = (id: string): string | null => {
    if (id === 'freeze') return `Є: ${streakFreezes}/${MAX_STREAK_FREEZES}`;
    if (id === 'shield3') return `Є: ${comboShields}`;
    if (id === 'hint3') return `Є: ${hints}`;
    if (id === 'double') return doubleCoins ? 'Активно' : null;
    if (id.startsWith('frame_')) return frames.includes(id.slice(6)) ? (frame === id.slice(6) ? 'Надіто' : 'Куплено') : null;
    return null;
  };

  const buy = (id: string) => {
    if (id.startsWith('frame_') && frames.includes(id.slice(6))) {
      equipFrame(id.slice(6));
      return;
    }
    const res = buyItem(id);
    setTalk(shopSay(res as ShopMsg));
  };

  const nextTick = energy < MAX_ENERGY ? ENERGY_REGEN_MS - (Date.now() - energyAt) : 0;

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <TopBar title="МАГАЗИН" />
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: insets.bottom + 30 }}>
        <GrindykSay text={talk.text} pose={talk.pose} height={110} onPress={() => setTalk(shopSay('welcome'))} />

        <View style={styles.energyCard}>
          <Icon name="energy" size={34} />
          <View style={{ flex: 1 }}>
            <Text style={styles.energyTitle}>
              Енергія {energy}/{MAX_ENERGY}
            </Text>
            <Text style={styles.energySub}>
              {energy >= MAX_ENERGY ? 'Повний бак. Вчись.' : `+10 через ${fmtLeft(nextTick)} · ще +10 за щоденний вхід`}
            </Text>
          </View>
        </View>

        {CATEGORIES.map((cat) => (
          <View key={cat} style={{ marginTop: 18 }}>
            <Text style={styles.cat}>{cat.toUpperCase()}</Text>
            {ITEMS.filter((i) => i.category === cat).map((item) => {
              const own = owned(item.id);
              const frameKey = item.id.startsWith('frame_') ? item.id.slice(6) : null;
              const canAfford = coins >= item.cost;
              const ownedFrame = frameKey && frames.includes(frameKey);
              return (
                <View key={item.id} style={styles.item}>
                  <View style={[styles.itemIcon, frameKey && { borderColor: FRAMES[frameKey].color, borderWidth: 3 }]}>
                    <Text style={{ fontSize: 26 }}>{item.icon}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                    {own && <Text style={styles.own}>{own}</Text>}
                  </View>
                  <Pressable
                    onPress={() => buy(item.id)}
                    disabled={!ownedFrame && !canAfford}
                    style={({ pressed }) => [
                      styles.buy,
                      !ownedFrame && !canAfford && styles.buyOff,
                      ownedFrame && styles.buyOwned,
                      pressed && { transform: [{ translateY: 2 }], borderBottomWidth: 2 },
                    ]}
                  >
                    {ownedFrame ? (
                      <Text style={styles.buyTxt}>{frame === frameKey ? '✓' : 'Одягти'}</Text>
                    ) : (
                      <View style={styles.priceRow}>
                        <Text style={[styles.buyTxt, !canAfford && { color: C.muted }]}>{item.cost}</Text>
                        <Icon name="coin" size={16} />
                      </View>
                    )}
                  </Pressable>
                </View>
              );
            })}
          </View>
        ))}

        <Text style={styles.foot}>Коїни заробляються за уроки, квізи та комбо. Підписок і реклами тут поки немає.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  energyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
    marginTop: 4,
  },
  energyTitle: { color: C.txt, fontWeight: '800', fontSize: 16 },
  energySub: { color: C.muted, fontSize: 13, marginTop: 2 },
  cat: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginBottom: 8 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: C.panel,
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.line,
  },
  itemIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: C.panel2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  itemTitle: { color: C.txt, fontWeight: '800', fontSize: 15 },
  itemDesc: { color: C.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  own: { color: C.accent, fontSize: 12, fontWeight: '800', marginTop: 4 },
  buy: {
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.panel2,
    borderRadius: 12,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderBottomWidth: 4,
    borderBottomColor: C.gold,
    borderWidth: 2,
    borderColor: C.gold,
  },
  buyOff: { borderColor: C.line, borderBottomColor: C.line },
  buyOwned: { borderColor: C.accent, borderBottomColor: C.accentEdge },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  buyTxt: { color: C.gold, fontWeight: '900', fontSize: 15 },
  foot: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 20 },
});

// HUD-пігулки зверху сцени (🔥/⭐/🪙/⚡): лише ці дрібні елементи темні на блюрі, усе велике (картки) світле й тепле.
import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useStore } from '../store';

const blur = Platform.OS === 'web' ? ({ backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' } as object) : {};

export const hudPill = { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, height: 32, borderRadius: 16, backgroundColor: 'rgba(13,15,20,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', ...blur } as const;

export function Hud() {
  const streak = useStore((s) => s.streak);
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const energy = useStore((s) => s.energy);
  const Item = ({ icon, v }: { icon: 'streak' | 'xp' | 'coin' | 'energy'; v: number }) => (
    <View style={hudPill}>
      <Icon name={icon} size={18} />
      <Text style={styles.txt}>{v}</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', gap: 6 }}>
      <Item icon="streak" v={streak} />
      <Item icon="xp" v={xp} />
      <Item icon="coin" v={coins} />
      <Item icon="energy" v={energy} />
    </View>
  );
}

const styles = StyleSheet.create({ txt: { color: '#eef2f7', fontWeight: '800', fontSize: 13 } });

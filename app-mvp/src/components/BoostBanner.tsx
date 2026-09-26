import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { boostLeftMs } from '../notifications';
import { C } from '../theme';

// Плашка «X2» із відліком: видно лише в 10-хвилинне вікно
export function BoostBanner() {
  const [left, setLeft] = useState(() => boostLeftMs());
  useEffect(() => {
    const t = setInterval(() => setLeft(boostLeftMs()), 1000);
    return () => clearInterval(t);
  }, []);
  if (left <= 0) return null;
  const s = Math.ceil(left / 1000);
  const mm = String(Math.floor(s / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return (
    <View style={styles.box}>
      <Text style={styles.icon}>⚡</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>X2 коїни й XP</Text>
        <Text style={styles.sub}>Пройди урок, поки йде таймер</Text>
      </View>
      <Text style={styles.time}>{mm}:{ss}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
    backgroundColor: '#2a2410',
    borderRadius: 16,
    padding: 14,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderColor: C.gold,
    borderBottomColor: C.goldEdge,
  },
  icon: { fontSize: 28 },
  title: { color: C.gold, fontWeight: '900', fontSize: 16 },
  sub: { color: C.muted, fontSize: 12, marginTop: 2 },
  time: { color: C.gold, fontWeight: '900', fontSize: 24, fontVariant: ['tabular-nums'] },
});

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CLOUD_MODE } from '../cloud/config';
import { useCloud } from '../cloud/cloudStore';
import { useTheme } from '../theme';

// Водяний знак з @ніком тестера поверх уроку й результатів: якщо скріншот чи запис екрана витече, видно, чий акаунт.
// Лише в закритому режимі й після входу; дотики пропускає (pointerEvents none).
const ROWS = 6;
const COLS = 3;

export function Watermark() {
  const C = useTheme();
  const nick = useCloud((s) => s.user?.username);
  if (CLOUD_MODE === 'off' || !nick) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {Array.from({ length: ROWS }, (_, r) => (
        <View key={r} style={styles.row}>
          {Array.from({ length: COLS }, (_, c) => (
            <Text key={c} style={[styles.txt, { color: C.txt }]} numberOfLines={1}>
              @{nick}
            </Text>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  txt: { fontSize: 15, fontWeight: '800', opacity: 0.07, transform: [{ rotate: '-24deg' }] },
});

import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { FRAMES } from '../data/shop';
import { C } from '../theme';

export function Avatar({ photo, name, frame = 'green', size = 96 }: { photo: string | null; name: string; frame?: string; size?: number }) {
  const f = FRAMES[frame] ?? FRAMES.green;
  return (
    <View
      style={[
        styles.box,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: f.color,
          borderBottomColor: f.edge,
          borderWidth: Math.max(3, size * 0.03),
          borderBottomWidth: Math.max(5, size * 0.06),
        },
      ]}
    >
      {photo ? (
        <Image source={{ uri: photo }} style={styles.img} />
      ) : (
        <Text style={{ color: f.color, fontSize: size * 0.44, fontWeight: '900' }}>{(name || 'Г').trim().charAt(0).toUpperCase()}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: C.panel2 },
  img: { width: '100%', height: '100%' },
});

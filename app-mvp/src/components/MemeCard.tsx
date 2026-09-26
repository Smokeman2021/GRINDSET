import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Meme } from '../data/memes';
import { pose } from '../data/poses';

export function MemeCard({ meme, locked }: { meme: Meme; locked?: boolean }) {
  const p = pose(meme.pose);
  return (
    <View style={[styles.card, { backgroundColor: locked ? '#15181f' : meme.bg }]}>
      {locked ? (
        <View style={styles.lock}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={styles.lockTxt}>Відкриється з досягненням</Text>
        </View>
      ) : (
        <>
          <Image source={p.src} style={styles.pose} resizeMode="contain" />
          <Text style={[styles.cap, styles.top]}>{meme.top}</Text>
          <Text style={[styles.cap, styles.bottom]}>{meme.bottom}</Text>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', width: '100%' },
  pose: { position: 'absolute', bottom: '14%', top: '16%', alignSelf: 'center', width: '70%' },
  cap: {
    position: 'absolute',
    left: 8,
    right: 8,
    textAlign: 'center',
    color: '#fff',
    fontWeight: '900',
    fontSize: 15,
    lineHeight: 18,
    textShadowColor: '#000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 4,
  },
  top: { top: 8 },
  bottom: { bottom: 8 },
  lock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
  lockTxt: { color: '#8b94a7', fontSize: 11, fontWeight: '700' },
});

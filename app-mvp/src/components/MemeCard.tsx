import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import type { Meme } from '../data/memes';
import { pose } from '../data/poses';
import { Theme, useStyles, useTheme } from '../theme';

export function MemeCard({ meme, locked }: { meme: Meme; locked?: boolean }) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const p = pose(meme.pose);
  return (
    <View style={[styles.card, { backgroundColor: locked ? C.panel2 : meme.bg }]}>
      {locked ? (
        <View style={styles.lock}>
          <Text style={{ fontSize: 44 }}>🔒</Text>
          <Text style={styles.lockTxt}>Відкриється з досягненням</Text>
        </View>
      ) : (
        <>
          <Text style={styles.cap}>{meme.top}</Text>
          <View style={styles.poseBox}>
            <Image source={p.src} style={styles.pose} resizeMode="contain" />
          </View>
          <Text style={styles.cap}>{meme.bottom}</Text>
        </>
      )}
    </View>
  );
}

// підписи лишаються білими з чорною обводкою в обох темах: вони лежать на кольоровому тлі мема
const makeStyles = (C: Theme) =>
  StyleSheet.create({
    // підписи й зображення йдуть колонкою: підпис не налазить на позу, навіть якщо займає 2-3 рядки
    card: { aspectRatio: 1, borderRadius: 14, overflow: 'hidden', width: '100%', paddingVertical: 8, paddingHorizontal: 8, justifyContent: 'space-between' },
    poseBox: { flex: 1, marginVertical: 4, minHeight: 0 },
    pose: { flex: 1, width: '100%' },
    cap: {
      textAlign: 'center',
      color: '#fff',
      fontWeight: '900',
      fontSize: 15,
      lineHeight: 18,
      textShadowColor: '#000',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 4,
    },
    lock: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6 },
    lockTxt: { color: C.muted, fontSize: 11, fontWeight: '700' },
  });

import React from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { art, FILL_IMG } from '../art';
import { resolveCharacter, type CharacterConfig } from '../art/character';
import { Theme, useStyles } from '../theme';

// Малює персонажа: пошарово (база + шари у фіксованому z-порядку на одному канвасі) або цілісним луком (fallback).
// Усі шари мають однаковий канвас, тому просто лежать один на одному на повний розмір.
export function CharacterView({ config, height = 220 }: { config: CharacterConfig | null; height?: number }) {
  const styles = useStyles(makeStyles);
  const r = resolveCharacter(config);
  const baseEntry = art(r.mode === 'layers' ? r.base : r.key);
  const width = height * baseEntry.ratio;
  const edge = Math.max(2, Math.round(height * 0.02));
  return (
    <View style={[styles.frame, { width, height, borderRadius: Math.round(height * 0.07), borderWidth: edge, borderBottomWidth: edge * 2 }]}>
      <Image source={baseEntry.src} style={FILL_IMG} resizeMode="cover" />
      {r.mode === 'layers' && r.layers.map((k) => <Image key={k} source={art(k).src} style={FILL_IMG} resizeMode="cover" />)}
    </View>
  );
}

const makeStyles = (C: Theme) => StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: C.panel2, borderColor: C.line } });

import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { ARCHETYPES, ArchetypeId, avatarFrame } from '../data/avatars';
import { CharacterAvatar } from './CharacterAvatar';
import { cardShadow, Theme, useStyles, useTheme } from '../theme';

// Вибір образу гравця: велике превʼю + сітка архетипів (чоловічі / жіночі). Використовується в онбордингу й у профілі.
export function ArchetypePicker({
  value,
  onSelect,
  stage = 1,
  previewHeight = 200,
}: {
  value: ArchetypeId | null;
  onSelect: (id: ArchetypeId) => void;
  stage?: number;
  previewHeight?: number;
}) {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const [gender, setGender] = useState<'m' | 'f'>(value ? (value[0] as 'm' | 'f') : 'm');
  return (
    <View>
      <View style={[styles.charBox, { minHeight: previewHeight + 10 }]}>
        {value ? <CharacterAvatar archetype={value} stage={stage} height={previewHeight} /> : <Text style={styles.empty}>Обери свій образ нижче</Text>}
      </View>
      <View style={styles.genderRow}>
        {(['m', 'f'] as const).map((g) => (
          <Pressable key={g} onPress={() => setGender(g)} style={[styles.genderBtn, gender === g && styles.genderOn]}>
            <Text style={[styles.genderTxt, gender === g && { color: C.onAccent }]}>{g === 'm' ? '♂ Чоловічий' : '♀ Жіночий'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.grid}>
        {ARCHETYPES.filter((a) => a.gender === gender).map((a) => {
          const f = avatarFrame(a.id, 1);
          const on = value === a.id;
          return (
            <Pressable key={a.id} onPress={() => onSelect(a.id)} style={[styles.cell, on && styles.cellOn]}>
              <Image source={f.src} style={{ width: 48 * f.ratio, height: 48 }} resizeMode="contain" />
              <Text style={[styles.lbl, on && { color: C.accentTxt }]} numberOfLines={1}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    charBox: { alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    empty: { color: C.muted, fontSize: 13 },
    genderRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
    genderBtn: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel2 },
    genderOn: { backgroundColor: C.accent, borderColor: C.accentEdge },
    genderTxt: { color: C.txt, fontWeight: '800', fontSize: 13 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: {
      width: '30%',
      flexGrow: 1,
      alignItems: 'center',
      backgroundColor: C.panel,
      borderRadius: 12,
      paddingVertical: 8,
      borderWidth: 2,
      borderBottomWidth: 4,
      borderColor: C.line,
      ...cardShadow(C, 'sm'),
    },
    cellOn: { borderColor: C.accent, borderBottomColor: C.accentEdge },
    lbl: { color: C.muted, fontSize: 10, marginTop: 4 },
  });

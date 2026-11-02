// Конструктор персонажа: база-архетип + шари (hair, skin, top, bottom, shoes, outer, accessory) у фіксованому z-порядку.
// Поки пошарових ассетів нема, працює fallback на цілісні луки (пресети й гардероб); слоти шарів з'являться самі,
// щойно в art-v2/character/layers/<слот>/ покладуть файли (див. src/art/character.ts). Збереження: у профіль гравця
// (стан синхронізується з Supabase разом із прогресом).
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { art, artName, type ArtKey } from '../src/art';
import { BASES, BASE_LABEL, DEFAULT_CHARACTER, SLOTS, SLOT_LABEL, baseKey, colorKeys, layerOptions, lookKeys, presetKeys, type BaseId, type CharacterConfig, type Slot } from '../src/art/character';
import { CharacterView } from '../src/components/CharacterView';
import { Glow } from '../src/components/Glow';
import { Button } from '../src/components/Button';
import { useStore } from '../src/store';
import { haptic } from '../src/telegram/webapp';
import { Theme, useStyles, useTheme } from '../src/theme';

const LOOK_LABEL: Record<string, string> = {
  look_track: 'Трек',
  look_hoodie: 'Худі',
  look_street: 'Стрітвер',
  look_smart: 'Смарт',
  look_lux: 'Люкс',
  look_suit: 'Костюм',
  color_denim: 'Денім',
  color_leather: 'Шкіра',
  color_red: 'Червоний',
  color_white: 'Білий',
};

function Thumb({ k, on, onPress, label }: { k: ArtKey; on: boolean; onPress: () => void; label: string }) {
  const styles = useStyles(makeStyles);
  const a = art(k);
  return (
    <Pressable onPress={onPress} style={[styles.thumb, on && styles.thumbOn]}>
      <Image source={a.src} style={styles.thumbImg} resizeMode="cover" />
      <Text style={styles.thumbTxt} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

export default function CharacterScreen() {
  const C = useTheme();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const saved = useStore((s) => s.character);
  const setCharacter = useStore((s) => s.setCharacter);
  const [cfg, setCfg] = useState<CharacterConfig>(saved ?? DEFAULT_CHARACTER);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved ?? DEFAULT_CHARACTER);

  const pickLook = (look: ArtKey | null) => {
    haptic.select();
    setCfg((c) => ({ ...c, look }));
  };
  const pickBase = (base: BaseId) => {
    haptic.select();
    setCfg((c) => ({ ...c, base, look: null })); // змінили основу: цілісний лук скидаємо, показуємо саму базу
  };
  const pickLayer = (slot: Slot, key: ArtKey | null) => {
    haptic.select();
    setCfg((c) => {
      const layers = { ...c.layers };
      if (key) layers[slot] = key;
      else delete layers[slot];
      return { ...c, layers };
    });
  };
  const save = () => {
    setCharacter(cfg);
    haptic.success();
    router.back();
  };

  const presets = presetKeys();
  const looks = [...lookKeys(), ...colorKeys()];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>Мій персонаж</Text>
        <View style={styles.preview}>
          <CharacterView config={cfg} height={320} />
        </View>

        <Text style={styles.h}>ГОТОВІ ОБРАЗИ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {presets.map((k, i) => (
            <Thumb key={k} k={k} label={`Образ ${i + 1}`} on={cfg.look === k} onPress={() => pickLook(k)} />
          ))}
        </ScrollView>

        <Text style={styles.h}>ОСНОВА</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {BASES.map((b) => (
            <Thumb key={b} k={baseKey(b)} label={BASE_LABEL[b]} on={cfg.base === b && !cfg.look} onPress={() => pickBase(b)} />
          ))}
        </ScrollView>

        <Text style={styles.h}>ОДЯГ (ЦІЛІСНІ ЛУКИ)</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {looks.map((k) => (
            <Thumb key={k} k={k} label={LOOK_LABEL[artName(k)] ?? artName(k)} on={cfg.look === k} onPress={() => pickLook(k)} />
          ))}
        </ScrollView>

        <Text style={styles.h}>ШАРИ</Text>
        {SLOTS.map((slot) => {
          const opts = layerOptions(slot);
          return (
            <View key={slot} style={styles.slot}>
              <Text style={styles.slotName}>{SLOT_LABEL[slot]}</Text>
              {opts.length === 0 ? (
                <Text style={styles.soon}>Шари цього слота прийдуть окремо. Поки вибирай цілісний образ вище.</Text>
              ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 8 }}>
                  <Pressable onPress={() => pickLayer(slot, null)} style={[styles.none, !cfg.layers[slot] && styles.thumbOn]}>
                    <Text style={styles.thumbTxt}>Без</Text>
                  </Pressable>
                  {opts.map((k) => (
                    <Thumb key={k} k={k} label={artName(k)} on={cfg.layers[slot] === k} onPress={() => pickLayer(slot, k)} />
                  ))}
                </ScrollView>
              )}
            </View>
          );
        })}
      </ScrollView>
      <View style={[styles.bar, { paddingBottom: insets.bottom + 12 }]}>
        <Button title={dirty ? 'Зберегти образ' : 'Готово'} onPress={dirty ? save : () => router.back()} />
      </View>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    back: { alignSelf: 'flex-start', paddingVertical: 6, marginBottom: 4 },
    backTxt: { color: C.accentTxt, fontWeight: '800', fontSize: 15 },
    title: { color: C.txt, fontSize: 22, fontWeight: '900', marginBottom: 12 },
    preview: { alignItems: 'center', marginBottom: 6 },
    h: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 20, marginBottom: 8 },
    thumb: { width: 88, borderRadius: 12, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel, overflow: 'hidden' },
    thumbOn: { borderColor: C.accent },
    thumbImg: { width: '100%', height: 112 },
    thumbTxt: { color: C.txt, fontSize: 11, fontWeight: '800', textAlign: 'center', paddingVertical: 5, paddingHorizontal: 3 },
    none: { width: 64, height: 64, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center' },
    slot: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderColor: C.line, padding: 12, marginBottom: 8 },
    slotName: { color: C.txt, fontWeight: '800', fontSize: 14 },
    soon: { color: C.muted, fontSize: 12, marginTop: 4 },
    bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  });

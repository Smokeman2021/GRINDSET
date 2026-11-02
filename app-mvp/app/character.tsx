// Конструктор персонажа. Модель: ОСНОВА (1 з 6 архетипів) + ОБРАЗ/ЛУК (1 з гардероба або готовий пресет) = дві НЕЗАЛЕЖНІ вибірки.
//  • Тап лише підсвічує вибір (highlight) і оновлює прев'ю; нічого не коммітиться, доки не натиснуто «Зберегти образ».
//  • Тап по основі змінює лише основу; тап по образу лише образ. Один ряд не стирає вибір іншого.
//  • Прев'ю поки показує обраний образ (wardrobe-арт це вже одягнена повна фігура), а коли образу нема: обрану основу.
//    Коли з'являться пошарові асети (art-v2/character/layers/<слот>/), прев'ю стане композитом база + шари без зміни пікерів.
// Збереження: у профіль гравця (стан синхронізується з Supabase разом із прогресом).
import React, { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { art, artName, FILL_IMG, type ArtKey } from '../src/art';
import { BASES, BASE_LABEL, DEFAULT_CHARACTER, SLOTS, SLOT_LABEL, baseKey, layerOptions, lookKeys, presetKeys, sanitizeCharacter, type BaseId, type CharacterConfig, type Slot } from '../src/art/character';
import { CharacterView } from '../src/components/CharacterView';
import { Glow } from '../src/components/Glow';
import { StageGlow } from '../src/art/StageGlow';
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
};

// Мініатюра-картка: фігура прозора, тому лежить на м'якому фоні картки, без обрізання
function Thumb({ k, on, onPress, label }: { k: ArtKey; on: boolean; onPress: () => void; label: string }) {
  const styles = useStyles(makeStyles);
  const a = art(k);
  return (
    <Pressable onPress={onPress} style={[styles.thumb, on && styles.thumbOn]}>
      <View style={styles.thumbArt}>
        <Image source={a.src} style={FILL_IMG} resizeMode="contain" />
      </View>
      <Text style={[styles.thumbTxt, on && { color: '#0d0f14' }]} numberOfLines={1}>
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
  const initial = sanitizeCharacter(saved) ?? DEFAULT_CHARACTER;
  const [cfg, setCfg] = useState<CharacterConfig>(initial);
  const dirty = JSON.stringify(cfg) !== JSON.stringify(initial);

  // Усі вибори лише міняють локальний стан-чернетку (highlight + прев'ю); у профіль іде тільки через «Зберегти»
  const pickBase = (base: BaseId) => {
    haptic.select();
    setCfg((c) => ({ ...c, base })); // look НЕ чіпаємо
  };
  const pickLook = (look: ArtKey | null) => {
    haptic.select();
    setCfg((c) => ({ ...c, look })); // base НЕ чіпаємо
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
  const looks = lookKeys();
  const lookName = cfg.look ? (LOOK_LABEL[artName(cfg.look)] ?? (cfg.look.includes('/presets/') ? `Образ ${artName(cfg.look).replace(/\D/g, '')}` : artName(cfg.look))) : 'без образу';

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <Glow />
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 110 }}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Text style={styles.backTxt}>‹ Назад</Text>
        </Pressable>
        <Text style={styles.title}>Мій персонаж</Text>

        <View style={styles.stage}>
          <StageGlow size={360} bottom={-10} />
          <CharacterView config={cfg} height={340} />
        </View>
        <Text style={styles.summary}>
          Основа: <Text style={styles.summaryB}>{BASE_LABEL[cfg.base]}</Text> · Образ: <Text style={styles.summaryB}>{lookName}</Text>
        </Text>

        <Text style={styles.h}>ГОТОВІ ОБРАЗИ</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {presets.map((k, i) => (
            <Thumb key={k} k={k} label={`Образ ${i + 1}`} on={cfg.look === k} onPress={() => pickLook(k)} />
          ))}
        </ScrollView>

        <Text style={styles.h}>ОСНОВА</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          {BASES.map((b) => (
            <Thumb key={b} k={baseKey(b)} label={BASE_LABEL[b]} on={cfg.base === b} onPress={() => pickBase(b)} />
          ))}
        </ScrollView>

        <Text style={styles.h}>ОБРАЗ / ЛУК</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
          <Pressable onPress={() => pickLook(null)} style={[styles.noLook, !cfg.look && styles.thumbOn]}>
            <Text style={[styles.thumbTxt, !cfg.look && { color: '#0d0f14' }]}>Без образу</Text>
          </Pressable>
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
                  <Pressable onPress={() => pickLayer(slot, null)} style={[styles.noLook, !cfg.layers[slot] && styles.thumbOn]}>
                    <Text style={[styles.thumbTxt, !cfg.layers[slot] && { color: '#0d0f14' }]}>Без</Text>
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
    title: { color: C.txt, fontSize: 22, fontWeight: '900', marginBottom: 6 },
    // «сцена» під фігурою: м'яке радіально-зелене світіння, фігура стоїть на ньому
    stage: { alignItems: 'center', justifyContent: 'flex-end', height: 360, marginTop: 4 },
    stageGlow: { position: 'absolute', bottom: 10, width: 300, height: 300, borderRadius: 150, backgroundColor: 'rgba(54,226,122,0.16)' },
    summary: { color: C.muted, fontSize: 13, textAlign: 'center', marginTop: 4 },
    summaryB: { color: C.txt, fontWeight: '800' },
    h: { color: C.muted, fontWeight: '800', fontSize: 12, letterSpacing: 1, marginTop: 20, marginBottom: 8 },
    thumb: { width: 88, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel, overflow: 'hidden' },
    thumbOn: { borderColor: C.accent, backgroundColor: C.accent },
    thumbArt: { width: '100%', height: 116, padding: 4 },
    thumbTxt: { color: C.txt, fontSize: 11, fontWeight: '800', textAlign: 'center', paddingVertical: 5, paddingHorizontal: 3 },
    noLook: { width: 88, borderRadius: 14, borderWidth: 2, borderBottomWidth: 4, borderColor: C.line, backgroundColor: C.panel, alignItems: 'center', justifyContent: 'center', minHeight: 140 },
    slot: { backgroundColor: C.panel, borderRadius: 14, borderWidth: 2, borderColor: C.line, padding: 12, marginBottom: 8 },
    slotName: { color: C.txt, fontWeight: '800', fontSize: 14 },
    soon: { color: C.muted, fontSize: 12, marginTop: 4 },
    bar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 20, paddingTop: 10, backgroundColor: C.bg, borderTopWidth: 1, borderTopColor: C.line },
  });

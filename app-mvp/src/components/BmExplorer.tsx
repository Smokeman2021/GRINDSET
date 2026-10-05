import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Pressable, ScrollView, useWindowDimensions, StyleSheet, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { findBmScreen, BM_SCREENS } from '../data/bm';
import { Theme, useStyles } from '../theme';

// Єдиний персистентний "екран", у якому живе весь рекламний кабінет: одна картинка на весь фрейм,
// натискання активного елемента просто підмінює картинку на іншу (leadsTo) — без переходу на новий
// роут і без шапки-квізу. Це і є "вбудований Ads Manager", який досліджують руками, а не читають.
const START_ID = 'campaigns-list';
const MENU_ID = 'main-nav-menu';

export function BmExplorer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { width: winW, height: winH } = useWindowDimensions();
  const [zoom, setZoom] = useState(1); // 1 → 1.7 → 2.5: кнопка 🔍 (на iOS додатково працює щипок)
  const [hintOff, setHintOff] = useState(false);
  const portraitPhone = winW < 600 && winH > winW;
  const [stack, setStack] = useState<string[]>([START_ID]);
  const [boxW, setBoxW] = useState(Math.min(winW, 1100));
  const scrollRef = useRef<ScrollView>(null);

  const currentId = stack[stack.length - 1];
  const screen = useMemo(() => findBmScreen(currentId) ?? BM_SCREENS[0], [currentId]);
  // Вузькі довгі знімки (меню, склеєні панелі) не розтягуємо на весь широкий екран — лишаємо читабельну ширину.
  const baseW = screen.imgW < 700 ? Math.min(boxW, 520) : Math.min(boxW, 1100);
  const drawW = baseW * zoom;
  const boxH = (drawW * screen.imgH) / screen.imgW;

  // Карту можна крутити в широкий формат; при виході з неї повертаємо портрет, як у решті застосунку.
  useEffect(() => {
    ScreenOrientation.unlockAsync().catch(() => {});
    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => {});
    };
  }, []);

  // Довгі "сторінки" (налаштування таргету, креативу) при зміні екрана скролимо назад нагору,
  // щоб не лишати користувача посеред попереднього довгого скріна на новому екрані.
  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  }, [currentId]);

  const go = useCallback((id: string) => {
    if (!findBmScreen(id)) return;
    setStack((s) => (s[s.length - 1] === id ? s : [...s, id]));
  }, []);
  const back = useCallback(() => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)), []);
  const home = useCallback(() => setStack([START_ID]), []);
  const menu = useCallback(() => go(MENU_ID), [go]);

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} style={styles.topBtn} hitSlop={10} accessibilityLabel="Вийти з карти">
          <Text style={styles.topBtnTxt}>✕</Text>
        </Pressable>
        {stack.length > 1 && (
          <Pressable onPress={back} style={styles.topBtn} hitSlop={10} accessibilityLabel="Назад">
            <Text style={styles.topBtnTxt}>←</Text>
          </Pressable>
        )}
        <Text style={styles.topTitle} numberOfLines={1}>{screen.title}</Text>
        <Pressable onPress={menu} style={styles.topBtn} hitSlop={10} accessibilityLabel="Меню кабінету">
          <Text style={styles.topBtnTxt}>☰</Text>
        </Pressable>
        <Pressable onPress={() => setZoom((z) => (z < 1.5 ? 1.7 : z < 2 ? 2.5 : 1))} style={styles.topBtn} hitSlop={10} accessibilityLabel="Масштаб">
          <Text style={styles.topBtnTxt}>{zoom === 1 ? '🔍' : `${zoom}×`}</Text>
        </Pressable>
        <Pressable onPress={home} style={styles.topBtn} hitSlop={10} accessibilityLabel="На початок">
          <Text style={styles.topBtnTxt}>⟲</Text>
        </Pressable>
      </View>
      {portraitPhone && !hintOff && (
        <Pressable onPress={() => setHintOff(true)} style={styles.hint}>
          <Text style={styles.hintTxt}>↻ Поверни телефон, і кабінет стане ширшим. Або збільш кнопкою 🔍 (на iPhone ще й щипком).</Text>
          <Text style={styles.hintX}>✕</Text>
        </Pressable>
      )}
      <View style={styles.frame} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={boxH > 0}
          maximumZoomScale={Platform.OS === 'ios' ? 3 : 1}
          minimumZoomScale={1}
          bouncesZoom
        >
          <ScrollView horizontal scrollEnabled={zoom > 1} showsHorizontalScrollIndicator={zoom > 1} nestedScrollEnabled contentContainerStyle={{ minWidth: boxW, justifyContent: 'center' }}>
          <View style={{ width: drawW, height: boxH }}>
            <Image source={screen.image} style={{ width: drawW, height: boxH }} resizeMode="contain" />
            {screen.hotspots.map((h) => {
              const navigable = !!h.leadsTo;
              const rect = {
                position: 'absolute' as const,
                left: (h.xPct / 100) * drawW,
                top: (h.yPct / 100) * boxH,
                width: (h.wPct / 100) * drawW,
                height: (h.hPct / 100) * boxH,
              };
              return (
                <Pressable
                  key={h.id}
                  disabled={!navigable}
                  onPress={() => h.leadsTo && go(h.leadsTo)}
                  style={({ pressed }) => [rect, styles.hotspot, navigable && styles.hotspotNav, navigable && pressed && styles.hotspotPressed]}
                />
              );
            })}
          </View>
          </ScrollView>
        </ScrollView>
      </View>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: C.bg },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingBottom: 10,
      gap: 10,
      backgroundColor: C.panel,
      borderBottomWidth: 1,
      borderBottomColor: C.line,
    },
    topBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: C.panel2, alignItems: 'center', justifyContent: 'center' },
    topBtnTxt: { color: C.txt, fontSize: 16, fontWeight: '900' },
    topTitle: { flex: 1, color: C.txt, fontSize: 13, fontWeight: '700', textAlign: 'center' },
    frame: { flex: 1, paddingTop: 8 },
    scroll: { flex: 1 },
    scrollContent: { paddingBottom: 24 },
    hint: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 12, marginTop: 8, padding: 10, borderRadius: 12, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.line },
    hintTxt: { flex: 1, color: C.txt, fontSize: 12, lineHeight: 16 },
    hintX: { color: C.muted, fontSize: 14, fontWeight: '900' },
    hotspot: { borderRadius: 4 },
    hotspotNav: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(90,167,255,0.5)' },
    hotspotPressed: { backgroundColor: 'rgba(90,167,255,0.18)' },
  });

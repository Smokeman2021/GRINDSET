import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Image, Pressable, ScrollView, useWindowDimensions, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { findBmScreen, BM_SCREENS } from '../data/bm';
import { Theme, useStyles } from '../theme';

// Єдиний персистентний "екран", у якому живе весь рекламний кабінет: одна картинка на весь фрейм,
// натискання активного елемента просто підмінює картинку на іншу (leadsTo) — без переходу на новий
// роут і без шапки-квізу. Це і є "вбудований Ads Manager", який досліджують руками, а не читають.
const START_ID = 'campaigns-list';

export function BmExplorer() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const styles = useStyles(makeStyles);
  const { width: winW } = useWindowDimensions();
  const [stack, setStack] = useState<string[]>([START_ID]);
  const [boxW, setBoxW] = useState(Math.min(winW, 640));
  const scrollRef = useRef<ScrollView>(null);

  const currentId = stack[stack.length - 1];
  const screen = useMemo(() => findBmScreen(currentId) ?? BM_SCREENS[0], [currentId]);
  const boxH = (boxW * screen.imgH) / screen.imgW;

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

  return (
    <View style={styles.screen}>
      <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => (stack.length > 1 ? back() : router.back())} style={styles.topBtn} hitSlop={10}>
          <Text style={styles.topBtnTxt}>{stack.length > 1 ? '←' : '✕'}</Text>
        </Pressable>
        <Text style={styles.topTitle} numberOfLines={1}>{screen.title}</Text>
        <Pressable onPress={home} style={styles.topBtn} hitSlop={10}>
          <Text style={styles.topBtnTxt}>⟲</Text>
        </Pressable>
      </View>
      <View style={styles.frame} onLayout={(e) => setBoxW(e.nativeEvent.layout.width)}>
        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={boxH > 0}
        >
          <View style={{ width: boxW, height: boxH }}>
            <Image source={screen.image} style={{ width: boxW, height: boxH }} resizeMode="contain" />
            {screen.hotspots.map((h) => {
              const navigable = !!h.leadsTo;
              const rect = {
                position: 'absolute' as const,
                left: (h.xPct / 100) * boxW,
                top: (h.yPct / 100) * boxH,
                width: (h.wPct / 100) * boxW,
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
    scrollContent: { alignItems: 'center', paddingBottom: 24 },
    hotspot: { borderRadius: 4 },
    hotspotNav: { borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(90,167,255,0.5)' },
    hotspotPressed: { backgroundColor: 'rgba(90,167,255,0.18)' },
  });

// «УРОКИ» = подорож Києвом (ТЗ A): два види однієї подорожі (вид-сцена всередині зупинки ↔ вид-карта з неба), анімація камери між ними
// (сцена відкидається назад і відлітає, карта «вкладається» зверху вниз) і ПЕРЕЇЗД між зупинками, коли гравець пройшов урок і їде далі.
// Тут немає вертикального ланцюга вузлів: поточна зупинка = одна сцена з однією ціллю, решта курсу = маршрут на карті.
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useIsFocused } from 'expo-router';
import { MODULES } from '../data/modules';
import type { PoseName } from '../data/poses';
import { useStore } from '../store';
import { JourneyMap } from './JourneyMap';
import { StopScene, type SceneQuiz } from './StopScene';
import { Travel } from './Travel';
import { allDone, currentStopIndex, stopAt, travelBetween } from './stops';

export type JourneyProps = {
  completed: string[];
  onOpen: (id: string) => void;
  talk: { text: string; pose: PoseName };
  onTalk: () => void;
  goal: { xp: number; target: number; label: string };
  claimable: number;
  dueCount: number;
  offerAdapt: boolean;
  onDismissAdapt: () => void;
};

type TravelState = { from: ReturnType<typeof stopAt>; to: ReturnType<typeof stopAt>; mode: ReturnType<typeof travelBetween>['mode']; act: ReturnType<typeof travelBetween>['act']; actChanged: boolean; xpGain: number; coinGain: number };

export function Journey(p: JourneyProps) {
  const focused = useIsFocused();
  const { height: winH } = useWindowDimensions();
  const xp = useStore((s) => s.xp);
  const coins = useStore((s) => s.coins);
  const journeyStop = useStore((s) => s.journeyStop);
  const journeyXp = useStore((s) => s.journeyXp);
  const journeyCoins = useStore((s) => s.journeyCoins);
  const arriveAt = useStore((s) => s.arriveAt);

  const curIdx = currentStopIndex(p.completed);
  const stop = stopAt(curIdx);
  const [travel, setTravel] = useState<TravelState | null>(null);

  // Приїзд: пройшли урок і повернулись на екран → їдемо до наступної зупинки (лише коли вкладка на екрані й нова зупинка в іншому закладі)
  useEffect(() => {
    if (!focused || travel) return;
    if (journeyStop === null || curIdx <= journeyStop) {
      if (journeyStop !== curIdx) arriveAt(curIdx, xp, coins);
      return;
    }
    const to = stopAt(curIdx);
    const from = stopAt(Math.max(journeyStop, curIdx - 1)); // після довгої перерви показуємо лише останній відрізок
    if (from.locId === to.locId) {
      arriveAt(curIdx, xp, coins);
      return;
    }
    const tb = travelBetween(from, to);
    setTravel({ from, to, mode: tb.mode, act: tb.act, actChanged: tb.actChanged, xpGain: Math.max(0, xp - journeyXp), coinGain: Math.max(0, coins - journeyCoins) });
  }, [focused, curIdx, journeyStop, travel]); // eslint-disable-line react-hooks/exhaustive-deps

  // ───────── перемикач видів і політ камери ─────────
  const cam = useRef(new Animated.Value(0)).current; // 0 = сцена, 1 = карта
  const [mapOn, setMapOn] = useState(false);
  const [mapMounted, setMapMounted] = useState(false);
  const openMap = () => {
    setMapMounted(true);
    setMapOn(true);
    Animated.timing(cam, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start();
  };
  const closeMap = () => {
    setMapOn(false);
    Animated.timing(cam, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.cubic), useNativeDriver: false }).start(({ finished }) => finished && setMapMounted(false));
  };

  const quizzes: SceneQuiz[] = MODULES[stop.moduleNo - 1].quizzes.map((q) => ({ id: q.id, title: q.title, unlocked: (q.requires ?? []).every((id) => p.completed.includes(id)), done: p.completed.includes(q.id) }));

  const sceneStyle = {
    opacity: cam.interpolate({ inputRange: [0, 0.5, 0.78], outputRange: [1, 0.55, 0] }),
    transform: [{ perspective: 900 }, { translateY: cam.interpolate({ inputRange: [0, 1], outputRange: [0, -winH * 0.14] }) }, { rotateX: cam.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '64deg'] }) }, { scale: cam.interpolate({ inputRange: [0, 1], outputRange: [1, 0.7] }) }],
  };
  const mapStyle = {
    opacity: cam.interpolate({ inputRange: [0, 0.3, 0.7], outputRange: [0, 0, 1] }),
    transform: [{ perspective: 900 }, { translateY: cam.interpolate({ inputRange: [0, 1], outputRange: [winH * 0.22, 0] }) }, { rotateX: cam.interpolate({ inputRange: [0, 1], outputRange: ['66deg', '0deg'] }) }, { scale: cam.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] }) }],
  };

  return (
    <View style={styles.root}>
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]} pointerEvents={mapOn ? 'none' : 'auto'}>
        <StopScene
          stop={stop}
          allDone={allDone(p.completed)}
          quizzes={quizzes}
          talk={p.talk}
          onTalk={p.onTalk}
          onStart={p.onOpen}
          onQuiz={p.onOpen}
          onMap={openMap}
          goal={p.goal}
          claimable={p.claimable}
          dueCount={p.dueCount}
          offerAdapt={p.offerAdapt}
          onDismissAdapt={p.onDismissAdapt}
          completedCount={p.completed.length}
        />
      </Animated.View>
      {mapMounted && (
        <Animated.View style={[StyleSheet.absoluteFill, mapStyle]} pointerEvents={mapOn ? 'auto' : 'none'}>
          <JourneyMap completed={p.completed} currentModule={stop.moduleNo} onClose={closeMap} onOpenLesson={(id) => p.onOpen(id)} />
        </Animated.View>
      )}
      {travel && (
        <Travel
          from={travel.from}
          to={travel.to}
          mode={travel.mode}
          act={travel.act}
          actChanged={travel.actChanged}
          xpGain={travel.xpGain}
          coinGain={travel.coinGain}
          onDone={() => {
            arriveAt(curIdx, xp, coins);
            setTravel(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: '#0d0f14', overflow: 'hidden' } });

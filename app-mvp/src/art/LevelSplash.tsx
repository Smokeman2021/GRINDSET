import React from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { PoseImage } from '../components/PoseImage';
import { pose } from '../data/poses';
import { Theme, useStyles } from '../theme';
import type { LevelScene } from './levels';
import { ObjectiveGlow } from './ObjectiveGlow';
import { ParallaxScene, sceneLayers } from './Parallax';
import { requestTilt } from './tilt';
import { WeatherOverlay, useSceneState } from './WeatherOverlay';

// Заставка рівня: плита світу (з паралаксом) + зелений ореол на цілі + точка старту + Гріндік у позі + заголовок «висить у просторі».
// Ореол і маркер старту приклеєні до плити (рухаються з нею), заголовок і погода лежать поверх екрана.
export function LevelSplash({ scene, kicker, title, task, onStart }: { scene: LevelScene; kicker: string; title: string; task: string; onStart: () => void }) {
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const weather = useSceneState();
  const layers = React.useMemo(() => sceneLayers(scene.plate), [scene.plate]);

  const start = async () => {
    await requestTilt(); // iOS просить дозвіл на гіроскоп саме від жесту
    onStart();
  };

  return (
    <View style={styles.root}>
      <ParallaxScene
        layers={layers}
        width={width}
        height={height}
        anchorLayer={Math.floor(layers.length / 2)}
        renderAnchored={(w, h) => (
          <>
            {/* маршрут від старту до цілі: пунктир з легким вигином */}
            <Svg pointerEvents="none" width={w} height={h} style={StyleSheet.absoluteFill}>
              <Path
                d={`M ${scene.start.x * w} ${scene.start.y * h} Q ${(scene.start.x + scene.goal.x) * w * 0.5 + w * 0.06} ${(scene.start.y + scene.goal.y) * h * 0.5} ${scene.goal.x * w} ${scene.goal.y * h + scene.goal.r * w * 0.35}`}
                stroke="#36e27a"
                strokeWidth={3}
                strokeDasharray="2 10"
                strokeLinecap="round"
                fill="none"
                opacity={0.85}
              />
            </Svg>
            <ObjectiveGlow x={scene.goal.x * w} y={scene.goal.y * h} radius={scene.goal.r * w * 1.15} intensity={1.35} />
            <View
              pointerEvents="none"
              style={[styles.startDot, { left: scene.start.x * w - 9, top: scene.start.y * h - 9 }]}
            />
            <Text pointerEvents="none" style={[styles.startTxt, { left: scene.start.x * w + 14, top: scene.start.y * h - 9 }]}>
              СТАРТ
            </Text>
          </>
        )}
      >
        <Svg pointerEvents="none" width={width} height={height} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="shT" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#080a0e" stopOpacity={0.7} />
              <Stop offset="1" stopColor="#080a0e" stopOpacity={0} />
            </LinearGradient>
            <LinearGradient id="shB" x1="0" y1="1" x2="0" y2="0">
              <Stop offset="0" stopColor="#080a0e" stopOpacity={0.82} />
              <Stop offset="1" stopColor="#080a0e" stopOpacity={0} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={width} height={300} fill="url(#shT)" />
          <Rect x={0} y={height - 360} width={width} height={360} fill="url(#shB)" />
        </Svg>
        <WeatherOverlay state={weather} />

        {/* заголовок рівня «висить» у просторі: нахилений, виходить за край кадру */}
        <View pointerEvents="none" style={[styles.titleBox, { top: insets.top + 28 }]}>
          <Text style={styles.kicker}>{kicker}</Text>
          <Text style={styles.title} numberOfLines={3}>
            {title.toUpperCase()}
          </Text>
        </View>

        {!scene.hasGrindik && (
          <View pointerEvents="none" style={[styles.pose, { bottom: insets.bottom + 150 }]}>
            <PoseImage p={pose(scene.pose)} height={190} />
          </View>
        )}

        <View style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.taskCard}>
            <Text style={styles.taskLabel}>ЗАВДАННЯ</Text>
            <Text style={styles.taskTxt}>{task}</Text>
          </View>
          <Button title="Поїхали" onPress={() => void start()} />
        </View>
      </ParallaxScene>
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: '#0d0f14' },
    titleBox: { position: 'absolute', left: -12, right: -30, transform: [{ rotate: '-3deg' }] },
    kicker: { alignSelf: 'flex-start', marginLeft: 36, backgroundColor: '#36e27a', color: '#0d0f14', fontWeight: '900', fontSize: 12, letterSpacing: 2, paddingHorizontal: 8, paddingVertical: 3 },
    title: {
      marginLeft: 30,
      marginTop: 4,
      color: '#ffc83d',
      fontSize: 38,
      lineHeight: 40,
      fontWeight: '900',
      letterSpacing: 1,
      textShadowColor: '#0d0f14',
      textShadowOffset: { width: 3, height: 3 },
      textShadowRadius: 0,
    },
    pose: { position: 'absolute', left: 16 },
    bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, gap: 10 },
    taskCard: { backgroundColor: 'rgba(13,15,20,0.82)', borderRadius: 16, borderWidth: 2, borderBottomWidth: 4, borderColor: '#262c38', padding: 14 },
    taskLabel: { color: '#36e27a', fontWeight: '900', fontSize: 11, letterSpacing: 1.5 },
    taskTxt: { color: '#eef2f7', fontSize: 16, fontWeight: '700', marginTop: 4 },
    startDot: { position: 'absolute', width: 18, height: 18, borderRadius: 9, borderWidth: 3, borderColor: '#eef2f7', backgroundColor: 'rgba(255,255,255,0.25)' },
    startTxt: { position: 'absolute', color: '#eef2f7', fontWeight: '900', fontSize: 11, letterSpacing: 1.5, textShadowColor: '#000', textShadowRadius: 4 },
  });

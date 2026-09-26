import React, { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { pose, PoseName } from '../data/poses';
import { C } from '../theme';

// Гріндік з хмаркою репліки. Постійно ледь «дихає», а хмарка з’являється з пружинкою.
// onPress (наприклад, нова репліка) вішається на весь блок.
export function GrindykSay({
  text,
  pose: poseName,
  height = 130,
  onPress,
  flip,
}: {
  text: string;
  pose: PoseName;
  height?: number;
  onPress?: () => void;
  flip?: boolean;
}) {
  const bob = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const p = pose(poseName);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  useEffect(() => {
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 6, tension: 120, useNativeDriver: true }).start();
  }, [text, pop]);

  const w = height * p.ratio;
  return (
    <Pressable onPress={onPress} style={[styles.row, flip && { flexDirection: 'row-reverse' }]}>
      <Animated.View
        style={{
          transform: [
            { translateY: bob.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
            { scaleY: bob.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
          ],
        }}
      >
        <Image source={p.src} style={{ width: w, height }} resizeMode="contain" />
      </Animated.View>
      <Animated.View
        style={[
          styles.bubble,
          flip ? styles.bubbleFlip : null,
          {
            opacity: pop,
            transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
          },
        ]}
      >
        <View style={[styles.tail, flip && styles.tailFlip]} />
        <Text style={styles.txt}>{text}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  bubble: {
    flex: 1,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderWidth: 2,
    borderBottomWidth: 4,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 28,
  },
  bubbleFlip: {},
  txt: { color: C.txt, fontSize: 15, lineHeight: 21, fontWeight: '600' },
  tail: {
    position: 'absolute',
    left: -9,
    bottom: 16,
    width: 14,
    height: 14,
    backgroundColor: C.panel,
    borderColor: C.line,
    borderLeftWidth: 2,
    borderBottomWidth: 2,
    transform: [{ rotate: '45deg' }],
  },
  tailFlip: { left: undefined, right: -9, transform: [{ rotate: '-135deg' }] },
});

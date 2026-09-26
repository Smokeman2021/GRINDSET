import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../theme';

const EDGE = 5;

export function Button({
  title,
  onPress,
  disabled,
  ghost,
  style,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  ghost?: boolean;
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        ghost && styles.ghost,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <Text style={[styles.txt, ghost && styles.ghostTxt, disabled && styles.disabledTxt]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    width: '100%',
    borderBottomWidth: EDGE,
    borderBottomColor: C.accentEdge,
  },
  pressed: {
    transform: [{ translateY: EDGE - 2 }],
    borderBottomWidth: 2,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: C.line,
    borderBottomWidth: EDGE - 1,
    borderBottomColor: C.line,
  },
  disabled: {
    backgroundColor: '#2a313f',
    borderBottomColor: '#20262f',
  },
  txt: { color: '#05140a', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  ghostTxt: { color: C.muted, fontWeight: '700' },
  disabledTxt: { color: '#5b6577' },
});

import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { C } from '../theme';

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
    paddingVertical: 16,
    alignItems: 'center',
    width: '100%',
  },
  pressed: { opacity: 0.85, transform: [{ translateY: 2 }] },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  disabled: { backgroundColor: '#2a313f' },
  txt: { color: '#05140a', fontSize: 17, fontWeight: '800' },
  ghostTxt: { color: C.muted, fontWeight: '600' },
  disabledTxt: { color: '#5b6577' },
});

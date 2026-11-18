// Ненавʼязливий статус (ТЗ 006, 2.1): частина прогресу лишилась на пристрої, бо сервер відхилив операцію за лімітом розміру.
// Решта черги синхронізується як завжди. Посилання «Повідомити» відкриває відгук із контекстом (вид операції, урок, збірка).
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Theme, useStyles } from '../theme';
import { useSyncStatus } from '../cloud/progressSync';
import { FeedbackSheet } from './FeedbackSheet';

export function unsyncedScreen(kinds: string[], n: number): string {
  return `sync-unsynced:${n}:${[...new Set(kinds)].join('+')}`.slice(0, 80);
}

export function UnsyncedNote() {
  const styles = useStyles(makeStyles);
  const dead = useSyncStatus((s) => s.unsynced);
  const [open, setOpen] = useState(false);
  if (!dead.length) return null;
  const lessonId = dead.find((d) => d.op.lessonId)?.op.lessonId;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <Text style={styles.txt}>⚠ Частину прогресу ще не синхронізовано. Вона збережена на цьому пристрої.</Text>
      <Pressable onPress={() => setOpen(true)} hitSlop={6} accessibilityLabel="Повідомити про несинхронізований прогрес">
        <Text style={styles.link}>Повідомити →</Text>
      </Pressable>
      <FeedbackSheet visible={open} onClose={() => setOpen(false)} context={{ screen: unsyncedScreen(dead.map((d) => d.op.kind), dead.length), lessonId }} />
    </View>
  );
}

const makeStyles = (C: Theme) =>
  StyleSheet.create({
    box: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, backgroundColor: C.panel2, borderRadius: 10, borderWidth: 1, borderColor: C.line, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 8 },
    txt: { color: C.muted, fontSize: 12, flexShrink: 1 },
    link: { color: C.blueTxt, fontSize: 12, fontWeight: '800' },
  });

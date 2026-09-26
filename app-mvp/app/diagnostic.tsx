import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../src/components/Button';
import { GrindykSay } from '../src/components/GrindykSay';
import { say } from '../src/data/phrases';
import { C } from '../src/theme';

// Вступ до діагностичного тесту: можна пройти або пропустити (тоді базовий трек для початківців)
export default function Diagnostic() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const talk = useMemo(() => say('diagIntro'), []);
  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <View>
        <GrindykSay text={talk.text} pose={talk.pose} height={190} />
        <Text style={styles.h1}>Діагностичний тест</Text>
        <Text style={styles.p}>
          10 питань з усіх модулів курсу. Так я зрозумію, з чого тобі краще почати, і чи не витрачатимеш час на те, що вже знаєш.
        </Text>
        <Text style={styles.p}>Нагород за тест нема. Але якщо пройдеш без жодної помилки з першої спроби, отримаєш ексклюзивні 😎 золоті окуляри.</Text>
      </View>
      <View style={{ gap: 12 }}>
        <Button title="Пройти тест" onPress={() => router.replace('/lesson/diagnostic')} />
        <Button title="Пропустити, почну з основ" onPress={() => router.replace('/home')} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 22, justifyContent: 'space-between' },
  h1: { color: C.txt, fontSize: 26, fontWeight: '900', marginTop: 18 },
  p: { color: C.muted, fontSize: 15, lineHeight: 22, marginTop: 10 },
});

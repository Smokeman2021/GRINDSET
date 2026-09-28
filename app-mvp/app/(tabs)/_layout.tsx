import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../src/theme';
import { useStore } from '../../src/store';
import { scheduleAll } from '../../src/notifications';
import { useT } from '../../src/i18n';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconOn]}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { notifEnabled, notifMorning, notifEvening, streak, playerName, campaigns } = useStore();
  const t = useT();
  const checksKey = JSON.stringify(campaigns.filter((c) => c.status === 'active' && c.remindTimes.length).map((c) => [c.id, c.name, c.remindTimes]));

  // Переплановуємо нагадування на 7 діб уперед при запуску і зміні налаштувань
  React.useEffect(() => {
    const checks = (JSON.parse(checksKey) as [string, string, string[]][]).map(([id, name, times]) => ({ id, name, times }));
    scheduleAll({ enabled: notifEnabled, morning: notifMorning, evening: notifEvening }, streak, playerName, checks);
  }, [notifEnabled, notifMorning, notifEvening, streak, playerName, checksKey]);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.accent,
        tabBarInactiveTintColor: C.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '700' },
        tabBarStyle: {
          backgroundColor: C.panel,
          borderTopColor: C.line,
          borderTopWidth: 2,
          height: 62 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 6,
        },
        sceneStyle: { backgroundColor: C.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{ title: t('tabLessons'), tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: t('tabLibrary'), tabBarIcon: ({ focused }) => <TabIcon glyph="📚" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: t('tabShop'), tabBarIcon: ({ focused }) => <TabIcon glyph="🛍️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="league"
        options={{ title: t('tabLeague'), tabBarIcon: ({ focused }) => <TabIcon glyph="🏆" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: t('tabProfile'), tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: '#1a2a20' },
});

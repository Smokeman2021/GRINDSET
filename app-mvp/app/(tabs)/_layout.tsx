import React from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { C } from '../../src/theme';

function TabIcon({ glyph, focused }: { glyph: string; focused: boolean }) {
  return (
    <View style={[styles.icon, focused && styles.iconOn]}>
      <Text style={{ fontSize: 22, opacity: focused ? 1 : 0.55 }}>{glyph}</Text>
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
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
        options={{ title: 'Уроки', tabBarIcon: ({ focused }) => <TabIcon glyph="🏠" focused={focused} /> }}
      />
      <Tabs.Screen
        name="library"
        options={{ title: 'Бібліотека', tabBarIcon: ({ focused }) => <TabIcon glyph="📚" focused={focused} /> }}
      />
      <Tabs.Screen
        name="shop"
        options={{ title: 'Магазин', tabBarIcon: ({ focused }) => <TabIcon glyph="🛍️" focused={focused} /> }}
      />
      <Tabs.Screen
        name="league"
        options={{ title: 'Рейтинг', tabBarIcon: ({ focused }) => <TabIcon glyph="🏆" focused={focused} /> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Профіль', tabBarIcon: ({ focused }) => <TabIcon glyph="👤" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  icon: { width: 44, height: 32, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  iconOn: { backgroundColor: '#1a2a20' },
});

import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useAuth } from '@/context/AuthContext';

function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>['name']; color: string }) {
  return <FontAwesome size={24} style={{ marginBottom: -2 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { firebaseUser, dbUser, loading, apiError, refreshUser } = useAuth();
  const c = Colors[colorScheme ?? 'light'];

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator size="large" color={c.tint} />
      </View>
    );
  }
  if (!firebaseUser) {
    return <Redirect href="/login" />;
  }
  if (!dbUser && apiError) {
    return (
      <View style={[styles.centered, styles.pad, { backgroundColor: c.background }]}>
        <Text style={[styles.title, { color: c.text }]}>Could not load profile</Text>
        <Text style={[styles.message, { color: c.muted }]}>{apiError}</Text>
        <Text style={[styles.hint, { color: c.muted }]}>
          The API may be unavailable. If you just deployed, ensure API routes are running.
        </Text>
        <TouchableOpacity style={[styles.retryBtn, { backgroundColor: c.primary }]} onPress={() => refreshUser()}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (!dbUser) {
    return <Redirect href="/login" />;
  }

  const tint = Colors[colorScheme ?? 'light'].tint;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: tint,
        headerShown: true,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="manual-entry"
        options={{
          title: 'Manual Entry',
          tabBarIcon: ({ color }) => <TabBarIcon name="edit" color={color} />,
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ color }) => <TabBarIcon name="bar-chart" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <TabBarIcon name="cog" color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  pad: { padding: 24 },
  title: { fontSize: 20, fontWeight: '600', marginBottom: 8 },
  message: { fontSize: 16, textAlign: 'center', marginBottom: 16 },
  hint: { fontSize: 14, textAlign: 'center', marginBottom: 24 },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

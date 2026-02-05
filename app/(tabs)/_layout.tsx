import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: '#007AFF', headerShown: true }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Opgaver',
          tabBarLabel: 'Opgaver',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>📝</Text>,
        }}
      />

      <Tabs.Screen
        name="sync"
        options={{
          title: 'Synkronisering',
          tabBarLabel: 'Synk',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>☁️</Text>,
        }}
      />

      <Tabs.Screen
        name="settings"
        options={{
          title: 'Profil',
          tabBarLabel: 'Profil',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tabs>
  );
}

import { Stack } from 'expo-router';
import React from 'react';
import { LogBox } from 'react-native';
import { TaskProvider } from '../context/task-context';

if (__DEV__) {
  LogBox.ignoreLogs(['props.pointerEvents is deprecated. Use style.pointerEvents']);
}

export default function RootLayout() {
  return (
    <TaskProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </TaskProvider>
  );
}


import { Stack } from 'expo-router';
import React from 'react';
import { TaskProvider } from '../context/TaskContext';

export default function RootLayout() {
  return (
    <TaskProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </TaskProvider>
  );
}

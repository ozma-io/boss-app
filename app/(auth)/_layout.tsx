import { Stack } from 'expo-router';
import React from 'react';

export default function AuthLayout(): React.JSX.Element {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="email-input" />
      <Stack.Screen name="email-confirm" />
    </Stack>
  );
}


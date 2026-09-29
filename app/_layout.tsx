import { useEffect, useState } from 'react';
import { Linking, View } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Notifications from 'expo-notifications';
import { Colors } from '../src/constants/theme';
import { runMigrations } from '../src/utils/migrate';
import { ensureAndroidChannels } from '../src/utils/notifications';

export default function RootLayout() {
  const [ready, setReady] = useState(false);

  // Run schema migrations before any screen reads data (fail-open: reads have fallbacks)
  useEffect(() => {
    runMigrations()
      .catch(e => console.warn('Migration failed:', e))
      .finally(() => setReady(true));
  }, []);

  // Android needs its notification channels to exist before anything is scheduled.
  // No-op on iOS.
  useEffect(() => { ensureAndroidChannels(); }, []);

  useEffect(() => {
    // When user taps an alarm notification → open music deep link
    const sub = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as any;
      if (data?.type === 'alarm' && data?.musicUri) {
        Linking.openURL(data.musicUri).catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (!ready) {
    return (
      <>
        <StatusBar style="light" backgroundColor={Colors.bg} translucent={false} />
        <View style={{ flex: 1, backgroundColor: Colors.bg }} />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" backgroundColor={Colors.bg} translucent={false} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.bg } }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}

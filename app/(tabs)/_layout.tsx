import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Colors, TAB_COLORS } from '../../src/constants/theme';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<string, { outline: IoniconName; filled: IoniconName }> = {
  Dashboard: { outline: 'grid-outline',           filled: 'grid' },
  Tasks:     { outline: 'checkmark-done-outline',  filled: 'checkmark-done' },
  Fitness:   { outline: 'barbell-outline',         filled: 'barbell' },
  Growth:    { outline: 'trending-up-outline',     filled: 'trending-up' },
  Settings:  { outline: 'settings-outline',        filled: 'settings' },
};

const TAB_ROUTES: Record<string, string> = {
  Dashboard: 'index',
  Tasks:     'tasks',
  Fitness:   'fitness',
  Growth:    'growth',
  Settings:  'settings',
};

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const route = TAB_ROUTES[label];
  const color = TAB_COLORS[route] || Colors.accent;
  const icons = TAB_ICONS[label];
  return (
    <View style={{
      width: 36,
      height: 28,
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {focused && (
        <View style={{
          position: 'absolute',
          bottom: 0,
          width: 16,
          height: 2,
          borderRadius: 1,
          backgroundColor: color,
        }} />
      )}
      <Ionicons
        name={focused ? icons.filled : icons.outline}
        size={20}
        color={focused ? color : Colors.textMuted}
      />
    </View>
  );
}

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 60 + insets.bottom;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Colors.bg, elevation: 0, shadowOpacity: 0 },
        headerTintColor: Colors.textSecondary,
        headerTitleStyle: { fontWeight: '600', fontSize: 15, letterSpacing: -0.2, color: Colors.text },
        tabBarStyle: {
          backgroundColor: Colors.card,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          height: tabBarHeight,
          paddingTop: 8,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
        },
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarLabelStyle: { fontSize: 9, fontWeight: '500', marginTop: 2, letterSpacing: 0.3 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ focused }) => <TabIcon label="Dashboard" focused={focused} />,
          tabBarActiveTintColor: TAB_COLORS.index,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ focused }) => <TabIcon label="Tasks" focused={focused} />,
          tabBarActiveTintColor: TAB_COLORS.tasks,
        }}
      />
      <Tabs.Screen
        name="fitness"
        options={{
          title: 'Fitness',
          tabBarIcon: ({ focused }) => <TabIcon label="Fitness" focused={focused} />,
          tabBarActiveTintColor: TAB_COLORS.fitness,
        }}
      />
      <Tabs.Screen
        name="growth"
        options={{
          title: 'Growth',
          tabBarIcon: ({ focused }) => <TabIcon label="Growth" focused={focused} />,
          tabBarActiveTintColor: TAB_COLORS.growth,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ focused }) => <TabIcon label="Settings" focused={focused} />,
          tabBarActiveTintColor: TAB_COLORS.settings,
        }}
      />
      {/* Hidden routes — reachable from the Dashboard "Jump To" row, not the tab bar.
          Each still needs a title, or expo-router falls back to the lowercase route name. */}
      <Tabs.Screen name="analytics" options={{ href: null, title: 'Analytics' }} />
      <Tabs.Screen name="journal" options={{ href: null, title: 'Journal' }} />
      <Tabs.Screen name="finance" options={{ href: null, title: 'Finance' }} />
      <Tabs.Screen name="alarms" options={{ href: null, title: 'Alarms', headerShown: true }} />
    </Tabs>
  );
}

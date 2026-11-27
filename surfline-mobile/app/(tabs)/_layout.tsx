import { Tabs } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { THEME } from '../../src/theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: any; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.accent,
        tabBarInactiveTintColor: THEME.textFaint,
        tabBarStyle: {
          backgroundColor: THEME.surface,
          borderTopColor: THEME.line,
          borderTopWidth: 1,
          height: 56,
          paddingBottom: 6,
          paddingTop: 4,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
      }}
      screenListeners={{
        tabPress: () => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Spots',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'water' : 'water-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="forecasts"
        options={{
          title: 'Previsión',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'analytics' : 'analytics-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="vigia"
        options={{
          title: 'Vigía',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'videocam' : 'videocam-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="tracking"
        options={{
          title: 'Sesión',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'pulse' : 'pulse-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color, size, focused }) => (
            <TabIcon name={focused ? 'people' : 'people-outline'} color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

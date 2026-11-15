import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet } from 'react-native';
import { THEME } from '../../src/theme/colors';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

function TabIcon({ name, color, size }: { name: IoniconName; color: any; size: number }) {
  return <Ionicons name={name} size={size} color={color} />;
}

function TabBarBackground() {
  return (
    <BlurView
      intensity={85}
      tint="dark"
      style={StyleSheet.absoluteFill}
    />
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: THEME.accent,
        tabBarInactiveTintColor: THEME.textFaint,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '700',
          letterSpacing: 0.2,
        },
        tabBarBackground: () => <TabBarBackground />,
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
            <TabIcon name={focused ? 'partly-sunny' : 'partly-sunny-outline'} color={color} size={size} />
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
            <TabIcon name={focused ? 'stopwatch' : 'stopwatch-outline'} color={color} size={size} />
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

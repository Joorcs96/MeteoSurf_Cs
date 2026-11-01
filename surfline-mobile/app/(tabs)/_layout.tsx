import { Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

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
        tabBarActiveTintColor: '#4fc3f7',
        tabBarInactiveTintColor: '#7a8fa6',
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
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
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="water-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="forecasts"
        options={{
          title: 'Previsión',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="analytics-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="vigia"
        options={{
          title: 'Vigía',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="videocam-outline" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: 'Comunidad',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people-outline" color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}

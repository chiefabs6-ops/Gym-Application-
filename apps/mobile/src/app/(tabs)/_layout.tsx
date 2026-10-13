import { Tabs } from 'expo-router';
import { ClipboardList, Dumbbell, History, Settings, TrendingUp } from 'lucide-react-native';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: '#121214', borderTopColor: '#2E2E35' },
        tabBarActiveTintColor: '#10B981',
        tabBarInactiveTintColor: '#71717A',
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Workout', tabBarIcon: ({ color }) => <Dumbbell size={22} color={color} /> }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: ({ color }) => <History size={22} color={color} /> }} />
      <Tabs.Screen name="routines" options={{ title: 'Routines', tabBarIcon: ({ color }) => <ClipboardList size={22} color={color} /> }} />
      <Tabs.Screen name="analytics" options={{ title: 'Analytics', tabBarIcon: ({ color }) => <TrendingUp size={22} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color }) => <Settings size={22} color={color} /> }} />
    </Tabs>
  );
}

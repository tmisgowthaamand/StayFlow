import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { Colors } from './src/theme/theme';
import Dashboard from './src/screens/Dashboard';
import Residents from './src/screens/Residents';
import Billing from './src/screens/Billing';
import Registrations from './src/screens/Registrations';
import Rooms from './src/screens/Rooms';
import EditTenant from './src/screens/EditTenant';
import Announcements from './src/screens/Announcements';
import { LayoutDashboard, Users, Zap, Settings, FileText, Map } from 'lucide-react-native';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          height: 60,
          paddingBottom: 10,
          paddingTop: 5,
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          if (route.name === 'Home') return <LayoutDashboard color={color} size={size} />;
          if (route.name === 'Rooms') return <Map color={color} size={size} />;
          if (route.name === 'Residents') return <Users color={color} size={size} />;
          if (route.name === 'New') return <FileText color={color} size={size} />;
          if (route.name === 'Billing') return <Zap color={color} size={size} />;
          return <Settings color={color} size={size} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={Dashboard} />
      <Tab.Screen name="Rooms" component={Rooms} />
      <Tab.Screen name="Residents" component={Residents} />
      <Tab.Screen name="New" component={Registrations} />
      <Tab.Screen name="Billing" component={Billing} />
    </Tab.Navigator>
  );
}

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={MainTabs} />
        <Stack.Screen name="EditTenant" component={EditTenant} />
        <Stack.Screen name="Announcements" component={Announcements} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

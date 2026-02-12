import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Colors } from './src/theme/theme';
import Dashboard from './src/screens/Dashboard';
import Residents from './src/screens/Residents';
import Billing from './src/screens/Billing';
import { LayoutDashboard, Users, Zap, Settings } from 'lucide-react-native';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <StatusBar style="dark" />
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
            let iconName;
            if (route.name === 'Home') return <LayoutDashboard color={color} size={size} />;
            if (route.name === 'Residents') return <Users color={color} size={size} />;
            if (route.name === 'Billing') return <Zap color={color} size={size} />;
            return <Settings color={color} size={size} />;
          },
        })}
      >
        <Tab.Screen name="Home" component={Dashboard} />
        <Tab.Screen name="Residents" component={Residents} />
        <Tab.Screen name="Billing" component={Billing} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

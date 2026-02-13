import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Easing, LogBox } from 'react-native';
import { Colors } from './src/theme/theme';

// Suppress common Expo Go / Firebase / Notification warnings that often clutter development
LogBox.ignoreLogs([
  'expo-notifications: Android Push notifications',
  'Remote notifications are removed',
  'Request failed with status code 404',
  'Firebase'
]);
import Dashboard from './src/screens/Dashboard';
import Residents from './src/screens/Residents';
import Billing from './src/screens/Billing';
import Registrations from './src/screens/Registrations';
import Rooms from './src/screens/Rooms';
import EditTenant from './src/screens/EditTenant';
import Announcements from './src/screens/Announcements';
import PDFViewer from './src/screens/PDFViewer';
import AddTenant from './src/screens/AddTenant';
import NotificationsScreen from './src/screens/Notifications';
import { LayoutDashboard, Users, Zap, FileText, Map } from 'lucide-react-native';
import { requestNotificationPermissions } from './src/utils/notifications';
import * as Notifications from 'expo-notifications';

// Configure notifications to show even when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// ─── Animated Tab Icon ─────────────────────────────────────────
function AnimatedTabIcon({ IconComponent, color, size, focused }) {
  const scale = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (focused) {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1.15,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: -2,
          friction: 4,
          tension: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.spring(scale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [focused]);

  return (
    <Animated.View
      style={{
        transform: [{ scale }, { translateY }],
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <IconComponent color={color} size={size} />
      {focused && (
        <View
          style={{
            width: 5,
            height: 5,
            borderRadius: 2.5,
            backgroundColor: color,
            marginTop: 4,
          }}
        />
      )}
    </Animated.View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textMuted,
        tabBarStyle: {
          height: 72,
          paddingBottom: 14,
          paddingTop: 10,
          backgroundColor: Colors.tabBarBg,
          borderTopWidth: 1,
          borderTopColor: Colors.tabBarBorder,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          letterSpacing: 0.3,
          marginTop: -2,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: LayoutDashboard,
            Rooms: Map,
            Residents: Users,
            New: FileText,
            Billing: Zap,
          };
          return (
            <AnimatedTabIcon
              IconComponent={icons[route.name]}
              color={color}
              size={size}
              focused={focused}
            />
          );
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
  useEffect(() => {
    requestNotificationPermissions();
  }, []);

  return (
    <View style={styles.container}>
      <NavigationContainer>
        <StatusBar style="light" backgroundColor={Colors.background} />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: Colors.background },
            animationEnabled: true,
            gestureEnabled: true,
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
            transitionSpec: {
              open: {
                animation: 'timing',
                config: { duration: 280, easing: Easing.out(Easing.cubic) },
              },
              close: {
                animation: 'timing',
                config: { duration: 220, easing: Easing.in(Easing.cubic) },
              },
            },
          }}
        >
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen name="EditTenant" component={EditTenant} />
          <Stack.Screen name="Announcements" component={Announcements} />
          <Stack.Screen name="PDFViewer" component={PDFViewer} />
          <Stack.Screen name="AddTenant" component={AddTenant} />
          <Stack.Screen name="Notifications" component={NotificationsScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

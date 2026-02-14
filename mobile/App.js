import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Easing, LogBox, Platform, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from './src/theme/theme';
import { LayoutDashboard, Users, Zap, FileText, Map } from 'lucide-react-native';


// Screens
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
import GeneralSettings from './src/screens/GeneralSettings';
import Login from './src/screens/Login';
import { requestNotificationPermissions } from './src/utils/notifications';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { ThemeProvider } from './src/context/ThemeContext';
import * as Notifications from 'expo-notifications';

// 🔔 Configure foreground notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

LogBox.ignoreLogs(['expo-notifications', 'Remote notifications', 'Firebase']);

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function AnimatedTabIcon({ IconComponent, color, size, focused }) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      friction: 4,
      tension: 40,
    }).start();
  }, [focused]);

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <IconComponent color={color} size={size} strokeWidth={focused ? 2.5 : 2} />
    </Animated.View>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSecondary,
        tabBarStyle: {
          position: 'absolute',
          bottom: 24,
          left: 16,
          right: 16,
          height: 72,
          borderRadius: 24,
          backgroundColor: 'rgba(15, 23, 42, 0.98)',
          borderTopWidth: 0,
          paddingBottom: 12,
          paddingTop: 8,
          elevation: 12,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.4,
          shadowRadius: 20,
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.05)',
        },
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          ...Typography.tiny,
          fontWeight: '700',
          marginTop: -4,
        },
        tabBarIcon: ({ color, size, focused }) => {
          const icons = {
            Home: LayoutDashboard,
            Rooms: Map,
            Residents: Users,
            New: FileText,
            Billing: Zap,
          };
          return <AnimatedTabIcon IconComponent={icons[route.name]} color={color} size={22} focused={focused} />;
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
  const [isLoading, setIsLoading] = React.useState(true);
  const [initialRoute, setInitialRoute] = React.useState('Login');

  useEffect(() => {
    const checkLogin = async () => {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          setInitialRoute('Main');
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };
    checkLogin();
    requestNotificationPermissions();
  }, []);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LanguageProvider>
        <ThemeProvider>
          <NavigationContainer>
            <StatusBar style="light" />
            <Stack.Navigator
              screenOptions={{
                headerShown: false,
                cardStyle: { backgroundColor: Colors.background },
                cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
              }}
              initialRouteName={initialRoute}
            >
              <Stack.Screen name="Login" component={Login} />
              <Stack.Screen name="Main" component={MainTabs} />
              <Stack.Screen name="EditTenant" component={EditTenant} />
              <Stack.Screen name="Announcements" component={Announcements} />
              <Stack.Screen name="PDFViewer" component={PDFViewer} />
              <Stack.Screen name="AddTenant" component={AddTenant} />
              <Stack.Screen name="Notifications" component={NotificationsScreen} />
              <Stack.Screen name="GeneralSettings" component={GeneralSettings} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </LanguageProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});

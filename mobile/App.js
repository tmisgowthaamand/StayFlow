import './src/utils/suppressWarnings';
import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { StatusBar } from 'expo-status-bar';
import { View, StyleSheet, Animated, Easing, LogBox, Platform, ActivityIndicator, Text } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from './src/theme/theme';
import { LayoutDashboard, Users, Zap, FileText, Map } from 'lucide-react-native';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('❌ App Error:', error);
    console.error('Error Info:', errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>❌ App Error</Text>
          <Text style={errorStyles.message}>
            {this.state.error?.toString() || 'Unknown error occurred'}
          </Text>
          <Text style={errorStyles.hint}>
            Check the terminal for detailed logs
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#020617',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 16,
  },
  message: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#475569',
    textAlign: 'center',
    marginTop: 16,
  },
});


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
import Queries from './src/screens/Queries';
import TenantDetails from './src/screens/TenantDetails';
import Login from './src/screens/Login';
import { requestNotificationPermissions, setupNotificationHandler } from './src/utils/notifications';
import { LanguageProvider, useLanguage } from './src/context/LanguageContext';
import { ThemeProvider } from './src/context/ThemeContext';

// 🔔 Configure foreground notifications (safe for Expo Go)
setupNotificationHandler();

LogBox.ignoreLogs(['expo-notifications', 'Remote notifications', 'Firebase', 'Android Push notifications']);

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
  const [error, setError] = React.useState(null);

  useEffect(() => {
    const checkLogin = async () => {
      try {
        console.log('🔍 Checking login status...');
        const token = await AsyncStorage.getItem('userToken');
        console.log('✅ AsyncStorage check complete');
        if (token) {
          setInitialRoute('Main');
        }
      } catch (e) {
        console.error('❌ AsyncStorage error:', e);
        setError(e.message);
      } finally {
        setIsLoading(false);
      }
    };
    
    const initNotifications = async () => {
      try {
        console.log('🔔 Requesting notification permissions...');
        await requestNotificationPermissions();
        console.log('✅ Notifications initialized');
      } catch (e) {
        console.error('⚠️ Notification error (non-critical):', e);
        // Don't block app if notifications fail
      }
    };
    
    checkLogin();
    initNotifications();
  }, []);

  if (error) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background, padding: 20 }}>
        <Text style={{ fontSize: 20, color: '#EF4444', marginBottom: 10 }}>❌ Initialization Error</Text>
        <Text style={{ fontSize: 14, color: '#94A3B8', textAlign: 'center' }}>{error}</Text>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={{ color: Colors.textSecondary, marginTop: 16 }}>Loading StayFlow...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
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
                <Stack.Screen name="Queries" component={Queries} />
                <Stack.Screen name="TenantDetails" component={TenantDetails} />
              </Stack.Navigator>
            </NavigationContainer>
          </ThemeProvider>
        </LanguageProvider>
      </View>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
});

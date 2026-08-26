import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ErrorBoundary from './src/components/ErrorBoundary';
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import WorkspaceScreen from './src/screens/WorkspaceScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { api, initAuth } from './src/services/api';
import { FONTS } from './src/theme/theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const [initialRoute, setInitialRoute] = useState('Onboarding');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function checkOnboarding() {
      try {
        // Restore persisted pairing token before any screen issues requests
        await initAuth();
        const config = await api.getConfig();
        if (config && config.onboardingCompleted) {
          setInitialRoute('Login');
        }
      } catch (_) {
        setInitialRoute('Onboarding');
      } finally {
        setIsReady(true);
      }
    }
    checkOnboarding();
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Stack.Navigator
            initialRouteName={initialRoute}
            screenOptions={{
              headerStyle: { backgroundColor: '#050B14' },
              headerTintColor: '#00e1ff',
              headerTitleStyle: { fontWeight: '800', color: '#ffffff', fontSize: 16 },
              contentStyle: { backgroundColor: '#050B14' },
            }}
          >
            <Stack.Screen name="Onboarding" component={OnboardingScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
            <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Workspaces' }} />
            <Stack.Screen name="Workspace" component={WorkspaceScreen} options={{ title: 'IDE Studio' }} />
            <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'Settings' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

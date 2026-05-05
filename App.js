import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import WorkspaceScreen from './src/screens/WorkspaceScreen';
import SettingsScreen from './src/screens/SettingsScreen';

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: { backgroundColor: '#0f172a' },
            headerTintColor: '#e2e8f0',
            contentStyle: { backgroundColor: '#0f172a' },
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Repositories' }} />
          <Stack.Screen name="Workspace" component={WorkspaceScreen} options={{ title: 'IDE' }} />
          <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: 'AI Settings' }} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

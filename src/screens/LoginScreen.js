import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import { LinearGradient } from 'expo-linear-gradient';

export default function LoginScreen({ navigation }) {
  const handleLogin = (provider) => {
    console.log(`Logging in with ${provider}`);
    navigation.replace('Dashboard');
  };

  return (
    <LinearGradient colors={['#0f172a', '#1e293b', '#334155']} style={styles.container}>
      <GlassContainer style={styles.glassPanel}>
        <Text style={styles.title}>Oroborous</Text>
        <Text style={styles.subtitle}>Welcome to the future of mobile IDEs</Text>

        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={styles.button} onPress={() => handleLogin('Claude')}>
            <Ionicons name="sparkles" size={24} color="#e2e8f0" />
            <Text style={styles.buttonText}>Continue with Claude</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => handleLogin('Google')}>
            <Ionicons name="logo-google" size={24} color="#e2e8f0" />
            <Text style={styles.buttonText}>Continue with Google</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.button} onPress={() => handleLogin('GitHub')}>
            <Ionicons name="logo-github" size={24} color="#e2e8f0" />
            <Text style={styles.buttonText}>Continue with GitHub</Text>
          </TouchableOpacity>
        </View>
      </GlassContainer>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  glassPanel: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: 40,
  },
  title: {
    fontSize: 42,
    fontWeight: '800',
    color: '#e2e8f0',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#cbd5e1',
    marginBottom: 40,
    textAlign: 'center',
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
});

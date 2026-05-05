import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, Easing } from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

// Background floating orbs
const Orb = ({ color, size, top, left, delay }) => {
  const translateY = useSharedValue(0);

  React.useEffect(() => {
    translateY.value = withRepeat(
      withTiming(30, { duration: 3000 + delay, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.orb,
        { backgroundColor: color, width: size, height: size, borderRadius: size / 2, top, left },
        animatedStyle,
      ]}
    />
  );
};

export default function LoginScreen({ navigation }) {
  const handleLogin = (provider) => {
    console.log(`Logging in with ${provider}`);
    navigation.replace('Dashboard');
  };

  return (
    <View style={styles.container}>
      {/* Deep dark gradient background */}
      <LinearGradient colors={['#050B14', '#0B192C', '#1E3E62']} style={StyleSheet.absoluteFill} />

      {/* Ambient Orbs */}
      <Orb color="rgba(34, 211, 238, 0.15)" size={200} top={height * 0.1} left={-50} delay={0} />
      <Orb color="rgba(168, 85, 247, 0.15)" size={250} top={height * 0.6} left={width * 0.5} delay={1000} />

      <FadeIn delay={100} style={styles.content}>
        <GlassContainer style={styles.glassPanel}>
          <FadeIn delay={200}>
            <Text style={styles.title}>Oroborous</Text>
          </FadeIn>

          <FadeIn delay={300}>
            <Text style={styles.subtitle}>The Most Advanced Mobile Agentic IDE.</Text>
            <View style={styles.divider} />
          </FadeIn>

          <View style={styles.buttonsContainer}>
            <FadeIn delay={400}>
              <TouchableOpacity onPress={() => handleLogin('Claude')} activeOpacity={0.8}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <Ionicons name="sparkles" size={24} color="#00e1ff" />
                  <Text style={styles.buttonText}>Continue with Claude</Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeIn>

            <FadeIn delay={500}>
              <TouchableOpacity onPress={() => handleLogin('Google')} activeOpacity={0.8}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <Ionicons name="logo-google" size={24} color="#e2e8f0" />
                  <Text style={styles.buttonText}>Continue with Google</Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeIn>

            <FadeIn delay={600}>
              <TouchableOpacity onPress={() => handleLogin('GitHub')} activeOpacity={0.8}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.1)', 'rgba(255, 255, 255, 0.05)']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                  style={styles.button}
                >
                  <Ionicons name="logo-github" size={24} color="#e2e8f0" />
                  <Text style={styles.buttonText}>Continue with GitHub</Text>
                </LinearGradient>
              </TouchableOpacity>
            </FadeIn>
          </View>
        </GlassContainer>
      </FadeIn>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#050B14',
  },
  orb: {
    position: 'absolute',
    filter: 'blur(40px)',
  },
  content: {
    width: '100%',
    paddingHorizontal: 24,
    alignItems: 'center',
    zIndex: 10,
  },
  glassPanel: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 48,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -1,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 24,
  },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: '#00e1ff',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 40,
    opacity: 0.8,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
    letterSpacing: 0.5,
  },
});

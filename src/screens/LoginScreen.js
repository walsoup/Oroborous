import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, useReducedMotion, withRepeat, withTiming, Easing } from 'react-native-reanimated';
import { FONTS } from '../theme/theme';

const { width, height } = Dimensions.get('window');

const Orb = ({ color, size, top, left, delay }) => {
  const translateY = useSharedValue(0);
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    // Under OS reduced-motion, orbs stay static at center instead of
    // freezing at a withRepeat end-pose offset
    if (reduceMotion) {
      translateY.value = 0;
      return;
    }
    translateY.value = withRepeat(
      withTiming(25, { duration: 3200 + delay, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, [reduceMotion]);

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
  // Press haptics are owned by BouncyButton; handler stays silent
  const handleLogin = (providerName) => {
    navigation.replace('Dashboard');
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#050B14', '#0B192C', '#1E3E62']} style={StyleSheet.absoluteFill} />

      {/* Floating Ambient Glowing Orbs */}
      <Orb color="rgba(0, 225, 255, 0.12)" size={220} top={height * 0.08} left={-40} delay={0} />
      <Orb color="rgba(192, 132, 252, 0.12)" size={260} top={height * 0.6} left={width * 0.45} delay={800} />

      <FadeIn delay={80} style={styles.content}>
        <GlassContainer style={styles.glassPanel} intensity={50}>
          <FadeIn delay={120}>
            <View style={styles.logoBadge}>
              <Ionicons name="terminal" size={28} color="#00e1ff" />
            </View>
            <Text style={styles.title}>Oroborous</Text>
            <Text style={styles.subtitle}>The Mobile-First Agentic IDE</Text>
            <Text style={styles.versionBadge}>v1.2 Stable Release • by itswal</Text>
            <View style={styles.divider} />
          </FadeIn>

          <View style={styles.buttonsContainer}>
            <FadeIn delay={200}>
              <BouncyButton
                style={styles.button}
                onPress={() => handleLogin('OpenRouter')}
                accessibilityLabel="continue-claude"
                hapticType="medium"
              >
                <Ionicons name="sparkles" size={20} color="#00e1ff" />
                <Text style={styles.buttonText}>Continue with AI Agent</Text>
              </BouncyButton>
            </FadeIn>

            <FadeIn delay={280}>
              <BouncyButton
                style={styles.button}
                onPress={() => handleLogin('GitHub')}
                accessibilityLabel="continue-github"
                hapticType="medium"
              >
                <Ionicons name="logo-github" size={20} color="#e2e8f0" />
                <Text style={styles.buttonText}>Continue with GitHub</Text>
              </BouncyButton>
            </FadeIn>

            <FadeIn delay={360}>
              <BouncyButton
                style={[styles.button, styles.buttonSecondary]}
                onPress={() => handleLogin('Offline')}
                hapticType="light"
              >
                <Ionicons name="laptop-outline" size={20} color="#94a3b8" />
                <Text style={[styles.buttonText, { color: '#94a3b8' }]}>Offline Local Workspace</Text>
              </BouncyButton>
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
  },
  content: {
    width: '100%',
    paddingHorizontal: 20,
    alignItems: 'center',
    zIndex: 10,
  },
  glassPanel: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 4,
    textAlign: 'center',
    fontWeight: '600',
  },
  versionBadge: {
    fontSize: 11,
    color: '#00e1ff',
    marginTop: 6,
    marginBottom: 14,
    textAlign: 'center',
    fontFamily: FONTS.mono,
  },
  divider: {
    width: 36,
    height: 3,
    backgroundColor: '#00e1ff',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 28,
  },
  buttonsContainer: {
    width: '100%',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import { api } from '../services/api';

const DOT_WIDTH = 6;
const DOT_WIDTH_ACTIVE = 20;

function Dot({ active, color }) {
  const width = useSharedValue(active ? DOT_WIDTH_ACTIVE : DOT_WIDTH);
  const bg = useSharedValue(0);

  useEffect(() => {
    width.value = withSpring(active ? DOT_WIDTH_ACTIVE : DOT_WIDTH, { damping: 18, stiffness: 260 });
    bg.value = withTiming(active ? 1 : 0, { duration: 180 });
  }, [active]);

  const dotStyle = useAnimatedStyle(() => ({
    width: width.value,
    backgroundColor: bg.value === 1 ? color : 'rgba(255, 255, 255, 0.15)',
  }));

  return <Animated.View style={[styles.dot, dotStyle]} />;
}

const SLIDES = [
  {
    id: 'welcome',
    icon: 'terminal',
    iconColor: '#00e1ff',
    title: 'Welcome to Oroborous',
    subtitle: 'The Mobile-First Agentic IDE',
    desc: 'Vibe code anywhere directly from your phone. Built with full native filesystem integration, interactive code editor, git suite, and hyper-terminal.',
  },
  {
    id: 'agents',
    icon: 'sparkles',
    iconColor: '#c084fc',
    title: 'Autonomous Multi-Agents',
    subtitle: 'Primary, Sub & Mini Agents',
    desc: 'Deploy autonomous software engineering agents powered by Claude 3.7, Gemini 2.0, DeepSeek, or OpenRouter to build, inspect, and self-verify code.',
  },
  {
    id: 'git',
    icon: 'git-branch',
    iconColor: '#4ade80',
    title: 'Complete Git & Terminal',
    subtitle: 'Side-by-Side Diffs & Shell Control',
    desc: 'Execute real terminal commands, inspect color-coded diffs, stage files, commit with AI message generation, and time-travel rewind anytime.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleNext = async () => {
    // Press haptic owned by BouncyButton — no double-fire here

    if (currentIndex < SLIDES.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      await finishOnboarding();
    }
  };

  const handleSkip = async () => {
    await finishOnboarding();
  };

  const finishOnboarding = async () => {
    try {
      await api.saveConfig({ onboardingCompleted: true });
    } catch (_) {}
    navigation.replace('Login');
  };

  const slide = SLIDES[currentIndex];

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#050B14', '#0F172A', '#1E293B']} style={StyleSheet.absoluteFill} />

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <View style={styles.contentContainer}>
        <GlassContainer style={styles.glassCard} intensity={45}>
          <FadeIn key={slide.id} delay={60} style={styles.slideInner}>
            <View style={[styles.iconCircle, { borderColor: `${slide.iconColor}40`, backgroundColor: `${slide.iconColor}15` }]}>
              <Ionicons name={slide.icon} size={40} color={slide.iconColor} />
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={[styles.subtitle, { color: slide.iconColor }]}>{slide.subtitle}</Text>
            <View style={styles.divider} />
            <Text style={styles.desc}>{slide.desc}</Text>
          </FadeIn>

          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <Dot key={idx} active={idx === currentIndex} color={slide.iconColor} />
            ))}
          </View>

          <BouncyButton
            style={[styles.nextButton, { backgroundColor: slide.iconColor }]}
            onPress={handleNext}
            hapticType="medium"
          >
            <Text style={styles.nextButtonText}>
              {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Continue'}
            </Text>
            <Ionicons
              name={currentIndex === SLIDES.length - 1 ? 'checkmark' : 'arrow-forward'}
              size={18}
              color="#050B14"
            />
          </BouncyButton>
        </GlassContainer>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  glassCard: {
    width: '100%',
    maxWidth: 400,
    padding: 28,
    alignItems: 'center',
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 4,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: 32,
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginBottom: 16,
  },
  desc: {
    fontSize: 13,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 24,
    alignItems: 'center',
  },
  dot: {
    height: DOT_WIDTH,
    borderRadius: DOT_WIDTH / 2,
  },
  activeDot: {
    width: DOT_WIDTH_ACTIVE,
  },
  inactiveDot: {
    width: DOT_WIDTH,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  nextButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 6,
  },
  nextButtonText: {
    color: '#050B14',
    fontSize: 15,
    fontWeight: '900',
  },
});

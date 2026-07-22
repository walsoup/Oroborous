import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { api } from '../services/api';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: 'welcome',
    icon: 'terminal',
    iconColor: '#00e1ff',
    title: 'Welcome to Oroborous',
    subtitle: 'The Mobile-First Agentic IDE',
    desc: 'Vibe code anywhere, right from your phone. Designed for modern developers with native Kotlin execution and Hermes performance.',
  },
  {
    id: 'agents',
    icon: 'sparkles',
    iconColor: '#c084fc',
    title: 'Multi-Agent AI Engine',
    subtitle: 'Primary, Sub & Mini Agents',
    desc: 'Deploy autonomous coding agents powered by Claude 3.5, Gemini, OpenRouter, or local Ollama models to build, debug, and test code.',
  },
  {
    id: 'git',
    icon: 'git-branch',
    iconColor: '#4ade80',
    title: 'Terminal & Git Control',
    subtitle: 'Full Native Workspaces',
    desc: 'Execute terminal commands, inspect side-by-side file diffs, stage changes, commit, and push directly to GitHub.',
  },
];

export default function OnboardingScreen({ navigation }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const slideX = useSharedValue(0);

  const handleNext = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    if (currentIndex < SLIDES.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      slideX.value = withSpring(nextIdx, { damping: 18, stiffness: 140 });
    } else {
      await finishOnboarding();
    }
  };

  const handleSkip = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
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

      {/* Skip Button */}
      <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      {/* Main Glass Panel */}
      <View style={styles.contentContainer}>
        <GlassContainer style={styles.glassCard} intensity={40}>
          <FadeIn key={slide.id} delay={100} style={styles.slideInner}>
            <View style={[styles.iconCircle, { borderColor: `${slide.iconColor}40`, backgroundColor: `${slide.iconColor}15` }]}>
              <Ionicons name={slide.icon} size={44} color={slide.iconColor} />
            </View>

            <Text style={styles.title}>{slide.title}</Text>
            <Text style={[styles.subtitle, { color: slide.iconColor }]}>{slide.subtitle}</Text>
            
            <View style={styles.divider} />

            <Text style={styles.desc}>{slide.desc}</Text>
          </FadeIn>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {SLIDES.map((_, idx) => (
              <View
                key={idx}
                style={[
                  styles.dot,
                  idx === currentIndex ? [styles.activeDot, { backgroundColor: slide.iconColor }] : styles.inactiveDot,
                ]}
              />
            ))}
          </View>

          {/* Bottom Action Button */}
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
    top: 54,
    right: 24,
    zIndex: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  skipText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  glassCard: {
    width: '100%',
    maxWidth: 420,
    padding: 32,
    alignItems: 'center',
  },
  slideInner: {
    alignItems: 'center',
    width: '100%',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 6,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  divider: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 2,
    marginBottom: 20,
  },
  desc: {
    fontSize: 14,
    color: '#cbd5e1',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 28,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 28,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    width: 24,
  },
  inactiveDot: {
    width: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  nextButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  nextButtonText: {
    color: '#050B14',
    fontSize: 16,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
});

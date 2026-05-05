import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function GlassContainer({ children, style, intensity = 60, tint = 'dark' }) {
  return (
    <View style={[styles.outerContainer, style]}>
      {/* Outer Glow / Border Simulation via Gradient */}
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.3)', 'rgba(255, 255, 255, 0.05)', 'rgba(255, 255, 255, 0.1)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.innerContainer}>
          <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(30, 41, 59, 0.6)', 'rgba(15, 23, 42, 0.8)']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.content}>
            {children}
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    borderRadius: 24,
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    backgroundColor: 'transparent',
  },
  gradientBorder: {
    borderRadius: 24,
    padding: 1, // This creates the 1px border effect
  },
  innerContainer: {
    borderRadius: 23,
    overflow: 'hidden',
    backgroundColor: 'transparent',
  },
  content: {
    padding: 24,
  },
});

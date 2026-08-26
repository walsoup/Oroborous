import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

export default function GlassContainer({ children, style, intensity = 40, tint = 'dark', glowColor = 'rgba(0, 225, 255, 0.15)' }) {
  return (
    <View style={[styles.outerContainer, style, { shadowColor: glowColor }]}>
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.03)', 'rgba(255, 255, 255, 0.08)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.gradientBorder}
      >
        <View style={styles.innerContainer}>
          {Platform.OS !== 'web' ? (
            <BlurView intensity={intensity} tint={tint} style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(20px)' }]} />
          )}
          <LinearGradient
            colors={['rgba(11, 25, 44, 0.45)', 'rgba(5, 11, 20, 0.55)']}
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
    borderRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
    backgroundColor: 'transparent',
  },
  gradientBorder: {
    borderRadius: 20,
    padding: 1,
  },
  // Translucent fill lets the blur actually read as glass
  innerContainer: {
    borderRadius: 19,
    overflow: 'hidden',
    backgroundColor: 'rgba(5, 11, 20, 0.62)',
  },
  // Callers own their insets (prevents silent double padding)
  content: {
    padding: 0,
  },
});

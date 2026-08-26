import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

const KEYS = [
  { label: 'ESC', value: '\x1b' },
  { label: 'TAB', value: '\t' },
  { label: 'CTRL-C', value: '^C', action: 'cancel' },
  { label: '|', value: '|' },
  { label: '~', value: '~' },
  { label: '/', value: '/' },
  { label: '-', value: '-' },
  { label: '_', value: '_' },
  { label: '&&', value: ' && ' },
  { label: '>', value: ' > ' },
  { label: '$', value: '$' },
  { label: '↑', value: 'UP', action: 'historyUp' },
  { label: '↓', value: 'DOWN', action: 'historyDown' },
  { label: 'Clear', value: 'clear', action: 'clear' },
];

export default function TerminalKeyBar({ onKeyPress, onSpecialAction }) {
  const handlePress = (k) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (k.action && onSpecialAction) {
      onSpecialAction(k.action);
    } else if (onKeyPress) {
      onKeyPress(k.value);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {KEYS.map((k, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.keyBtn, k.action === 'cancel' && styles.keyCancel]}
            onPress={() => handlePress(k)}
            activeOpacity={0.7}
            hitSlop={{ top: 4, bottom: 4, left: 2, right: 2 }}
          >
            <Text style={[styles.keyText, k.action === 'cancel' && styles.keyTextCancel]}>
              {k.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#050B14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 5,
  },
  scrollContent: {
    paddingHorizontal: 8,
    gap: 6,
  },
  keyBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 44,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyCancel: {
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderColor: 'rgba(248, 113, 113, 0.3)',
  },
  keyText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  keyTextCancel: {
    color: '#f87171',
  },
});

import React from 'react';
import { TouchableWithoutFeedback, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function BouncyButton({ children, onPress, style, disabled, hapticType = 'light' }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
      opacity: disabled ? 0.45 : 1,
    };
  });

  const onPressIn = () => {
    if (disabled) return;
    // Single ownership rule: this component owns press haptics.
    // Handlers should only fire result-level notificationAsync (Success/Error).
    scale.value = withSpring(0.94, { damping: 17, stiffness: 320 });

    if (Platform.OS !== 'web') {
      if (hapticType === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } else if (hapticType === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } else if (hapticType === 'heavy') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      }
    }
  };

  const onPressOut = () => {
    scale.value = withSpring(1, { damping: 14, stiffness: 260 });
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}

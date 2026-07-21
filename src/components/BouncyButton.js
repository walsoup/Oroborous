import React from 'react';
import { TouchableWithoutFeedback, Platform } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

export default function BouncyButton({ children, onPress, style, disabled, hapticType = 'light' }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const onPressIn = () => {
    if (disabled) return;
    scale.value = withSpring(0.94, { damping: 15, stiffness: 300 });
    
    // Trigger haptic feedback on press-in for instant tactile response
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
    scale.value = withSpring(1, { damping: 12, stiffness: 250 });
  };

  return (
    <TouchableWithoutFeedback
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={disabled ? undefined : onPress}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </TouchableWithoutFeedback>
  );
}
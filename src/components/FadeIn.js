import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';

export default function FadeIn({ children, delay = 0, duration = 600, style }) {
  return (
    <Animated.View
      entering={FadeInDown.delay(delay).duration(duration).springify().damping(12).stiffness(90)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

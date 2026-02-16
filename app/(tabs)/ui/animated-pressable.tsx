import React from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

type AnimatedPressableProps = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  pressScale?: number;
};

const AnimatedPressableBase = Animated.createAnimatedComponent(Pressable);

export function AnimatedPressable({ style, disabled, pressScale = 0.97, onPressIn, onPressOut, ...props }: AnimatedPressableProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: disabled ? 0.6 : 1,
  }));

  return (
    <AnimatedPressableBase
      {...props}
      disabled={disabled}
      style={[style, animatedStyle]}
      onPressIn={event => {
        scale.value = withTiming(pressScale, { duration: 110 });
        onPressIn?.(event);
      }}
      onPressOut={event => {
        scale.value = withTiming(1, { duration: 120 });
        onPressOut?.(event);
      }}
    />
  );
}

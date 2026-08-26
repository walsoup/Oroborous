import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { THEMES, FONTS, SPRINGS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function GoalTracker({ todos = [] }) {
  const [isExpanded, setIsExpanded] = useState(true);
  const progressValue = useSharedValue(0);
  const chevronRotation = useSharedValue(0);

  const completedCount = todos.filter(t => t.status === 'completed').length;
  const totalCount = todos.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  // Spring the bar instead of snapping between plan updates
  useEffect(() => {
    progressValue.value = withSpring(progressPercent, SPRINGS.gentle);
  }, [progressPercent]);

  useEffect(() => {
    chevronRotation.value = withSpring(isExpanded ? 0 : 180, SPRINGS.snappy);
  }, [isExpanded]);

  const barStyle = useAnimatedStyle(() => ({
    width: `${progressValue.value}%`,
  }));

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${chevronRotation.value}deg` }],
  }));

  if (!todos || todos.length === 0) return null;

  const toggleExpand = () => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(prev => !prev);
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <TouchableOpacity style={styles.header} onPress={toggleExpand} activeOpacity={0.8}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="list-circle" size={18} color={THEMES.cyberpunk.primary} />
          <Text style={styles.headerTitle}>Task Plan ({completedCount}/{totalCount})</Text>
        </View>

        <View style={styles.headerRight}>
          <Text style={styles.percentText}>{progressPercent}%</Text>
          <Animated.View style={chevronStyle}>
            <Ionicons name="chevron-up" size={14} color={THEMES.cyberpunk.textMuted} />
          </Animated.View>
        </View>
      </TouchableOpacity>

      {/* Progress Line */}
      <View style={styles.progressBarBg}>
        <Animated.View style={[styles.progressBarFill, barStyle]} />
      </View>

      {/* Expanded Todos List */}
      {isExpanded && (
        <View style={styles.list}>
          {todos.map((todo, idx) => {
            const isDone = todo.status === 'completed';
            const isCurrent = todo.status === 'in_progress' || todo.status === 'running';

            let iconName = 'ellipse-outline';
            let iconColor = THEMES.cyberpunk.textDim;
            if (isDone) {
              iconName = 'checkmark-circle';
              iconColor = THEMES.cyberpunk.success;
            } else if (isCurrent) {
              iconName = 'sync-circle';
              iconColor = THEMES.cyberpunk.primary;
            }

            return (
              <View key={idx} style={styles.todoItem}>
                <Ionicons name={iconName} size={16} color={iconColor} style={{ marginRight: 8 }} />
                <Text
                  style={[
                    styles.todoText,
                    isDone && styles.todoTextDone,
                    isCurrent && styles.todoTextCurrent,
                  ]}
                  numberOfLines={2}
                >
                  {todo.task || todo.title || todo.content}
                </Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B192C',
    borderRadius: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  percentText: {
    color: THEMES.cyberpunk.primary,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  progressBarBg: {
    height: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    width: '100%',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#00e1ff',
  },
  list: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  todoText: {
    color: '#cbd5e1',
    fontSize: 12,
    flex: 1,
  },
  todoTextDone: {
    color: '#64748b',
    textDecorationLine: 'line-through',
  },
  todoTextCurrent: {
    color: '#00e1ff',
    fontWeight: '600',
  },
});

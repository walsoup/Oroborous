import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function DiffViewer({ diffText = '', filePath, onStageFile, onUnstageFile, isStaged = false }) {
  if (!diffText || diffText.trim() === 'No differences' || diffText.trim() === '') {
    return (
      <View style={styles.emptyContainer}>
        <Ionicons name="checkmark-circle-outline" size={40} color={THEMES.cyberpunk.success} />
        <Text style={styles.emptyTitle}>No Changes in this file</Text>
        <Text style={styles.emptySub}>Working tree matches commit</Text>
      </View>
    );
  }

  const lines = diffText.split('\n');
  let adds = 0;
  let dels = 0;

  lines.forEach(l => {
    if (l.startsWith('+') && !l.startsWith('+++')) adds++;
    if (l.startsWith('-') && !l.startsWith('---')) dels++;
  });

  return (
    <View style={styles.container}>
      {/* Diff Header */}
      <View style={styles.header}>
        <View style={styles.headerInfo}>
          <Text style={styles.filePath} numberOfLines={1}>
            {filePath || 'Diff Overview'}
          </Text>
          <View style={styles.statsBadgeRow}>
            <Text style={styles.addStat}>+{adds}</Text>
            <Text style={styles.delStat}>-{dels}</Text>
          </View>
        </View>

        {onStageFile || onUnstageFile ? (
          <TouchableOpacity
            style={[styles.stageBtn, isStaged ? styles.unstageBtn : null]}
            onPress={() => {
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (isStaged) {
                onUnstageFile && onUnstageFile(filePath);
              } else {
                onStageFile && onStageFile(filePath);
              }
            }}
          >
            <Ionicons name={isStaged ? "remove-circle-outline" : "add-circle-outline"} size={14} color="#050B14" />
            <Text style={styles.stageBtnText}>{isStaged ? 'Unstage' : 'Stage'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Diff Scrollable Lines */}
      <ScrollView style={styles.diffScroll} showsVerticalScrollIndicator={true} showsHorizontalScrollIndicator={true}>
        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.diffBody}>
            {lines.map((line, idx) => {
              let rowStyle = styles.lineNormal;
              let textStyle = styles.textNormal;

              if (line.startsWith('+') && !line.startsWith('+++')) {
                rowStyle = styles.lineAddition;
                textStyle = styles.textAddition;
              } else if (line.startsWith('-') && !line.startsWith('---')) {
                rowStyle = styles.lineDeletion;
                textStyle = styles.textDeletion;
              } else if (line.startsWith('@@')) {
                rowStyle = styles.lineMeta;
                textStyle = styles.textMeta;
              }

              return (
                <View key={idx} style={[styles.lineRow, rowStyle]}>
                  <Text style={[styles.lineText, textStyle]}>{line}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#050B14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  filePath: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.mono,
  },
  statsBadgeRow: {
    flexDirection: 'row',
    gap: 4,
  },
  addStat: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  delStat: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  stageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#00e1ff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  // Neutral slate for unstage — purple stays reserved for AI/agent surfaces
  unstageBtn: {
    backgroundColor: '#94a3b8',
  },
  stageBtnText: {
    color: '#050B14',
    fontSize: 11,
    fontWeight: '700',
  },
  diffScroll: {
    flex: 1,
  },
  diffBody: {
    paddingVertical: 8,
    minWidth: '100%',
  },
  lineRow: {
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  lineNormal: {},
  lineAddition: {
    backgroundColor: 'rgba(74, 222, 128, 0.12)',
  },
  lineDeletion: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
  },
  lineMeta: {
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  lineText: {
    fontFamily: FONTS.mono,
    fontSize: 12,
    lineHeight: 18,
  },
  textNormal: {
    color: '#cbd5e1',
  },
  textAddition: {
    color: '#4ade80',
  },
  textDeletion: {
    color: '#f87171',
  },
  textMeta: {
    color: '#38bdf8',
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#020617',
  },
  emptyTitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 12,
  },
  emptySub: {
    color: '#64748b',
    fontSize: 13,
    marginTop: 4,
  },
});

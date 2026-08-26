import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';
import BouncyButton from './BouncyButton';

export default function ActionDeck({ onQuickAction, projectScripts = {} }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleAction = (actionKey, payload) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsOpen(false);
    if (onQuickAction) onQuickAction(actionKey, payload);
  };

  return (
    <>
      {/* Floating Trigger */}
      <BouncyButton
        style={styles.floatingTrigger}
        onPress={() => setIsOpen(true)}
        hapticType="medium"
      >
        <Ionicons name="flash" size={20} color="#050B14" />
      </BouncyButton>

      {/* Action Sheet Modal */}
      <Modal visible={isOpen} transparent animationType="slide" onRequestClose={() => setIsOpen(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setIsOpen(false)}>
          <View style={styles.sheetContainer} onStartShouldSetResponder={() => true}>
            <View style={styles.handleBar} />
            <Text style={styles.sheetTitle}>Quick Action Deck</Text>

            <View style={styles.grid}>
              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => handleAction('ai-prompt', '/fix Find and fix errors in the current workspace')}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(0, 225, 255, 0.15)' }]}>
                  <Ionicons name="sparkles" size={20} color="#00e1ff" />
                </View>
                <Text style={styles.cardLabel}>AI Fix Bugs</Text>
                <Text style={styles.cardSub}>Diagnose & patch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => handleAction('terminal-cmd', projectScripts.test || 'npm test')}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(192, 132, 252, 0.15)' }]}>
                  <Ionicons name="flask" size={20} color="#c084fc" />
                </View>
                <Text style={styles.cardLabel}>Run Tests</Text>
                <Text style={styles.cardSub}>{projectScripts.test || 'npm test'}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => handleAction('terminal-cmd', projectScripts.lint || 'npm run lint || npx eslint .')}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(74, 222, 128, 0.15)' }]}>
                  <Ionicons name="checkmark-done" size={20} color="#4ade80" />
                </View>
                <Text style={styles.cardLabel}>Run Linter</Text>
                <Text style={styles.cardSub}>Check code quality</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.gridCard}
                onPress={() => handleAction('git-sync')}
                activeOpacity={0.8}
              >
                <View style={[styles.iconBox, { backgroundColor: 'rgba(56, 189, 248, 0.15)' }]}>
                  <Ionicons name="sync" size={20} color="#38bdf8" />
                </View>
                <Text style={styles.cardLabel}>Git Sync</Text>
                <Text style={styles.cardSub}>Stage, commit, push</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsOpen(false)}>
              <Text style={styles.cancelText}>Close</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  floatingTrigger: {
    position: 'absolute',
    bottom: 74,
    right: 18,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#00e1ff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
    zIndex: 99,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0B192C',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 225, 255, 0.3)',
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  gridCard: {
    width: '48%',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  cardLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  cardSub: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelText: {
    color: '#94a3b8',
    fontSize: 14,
    fontWeight: '600',
  },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, Modal, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function CommandPalette({ visible, onClose, files = [], onSelectFile, onExecuteAction }) {
  const [query, setQuery] = useState('');

  if (!visible) return null;

  const filteredFiles = files
    .filter(f => !query || f.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 15);

  const actions = [
    { id: 'agent-fix', label: 'AI: Diagnose and fix current file', icon: 'sparkles', color: '#00e1ff', prompt: '/fix Analyze and fix any bugs in this file' },
    { id: 'agent-test', label: 'AI: Write and run unit tests', icon: 'flask', color: '#c084fc', prompt: '/test Write and run tests for this workspace' },
    { id: 'git-status', label: 'Git: Check workspace status', icon: 'git-branch', color: '#4ade80', cmd: 'git status' },
    { id: 'git-pull', label: 'Git: Pull latest changes', icon: 'cloud-download', color: '#38bdf8', cmd: 'git pull' },
    { id: 'term-clean', label: 'Terminal: Clear logs', icon: 'trash-outline', color: '#f87171', action: 'clear' },
  ].filter(a => !query || a.label.toLowerCase().includes(query.toLowerCase()));

  const handleSelectFile = (file) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onSelectFile) onSelectFile(file);
    onClose();
  };

  const handleSelectAction = (act) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onExecuteAction) onExecuteAction(act);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.card} onStartShouldSetResponder={() => true}>
          {/* Search Header */}
          <View style={styles.searchHeader}>
            <Ionicons name="search" size={18} color={THEMES.cyberpunk.primary} />
            <TextInput
              style={styles.input}
              placeholder="Search files or commands..."
              placeholderTextColor={THEMES.cyberpunk.textDim}
              value={query}
              onChangeText={setQuery}
              autoCapitalize="none"
              autoFocus
            />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={18} color={THEMES.cyberpunk.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Results List */}
          <ScrollView style={styles.resultsScroll} showsVerticalScrollIndicator={true}>
            {actions.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Quick Actions</Text>
                {actions.map(act => (
                  <TouchableOpacity
                    key={act.id}
                    style={styles.itemRow}
                    onPress={() => handleSelectAction(act)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name={act.icon} size={16} color={act.color} style={{ marginRight: 8 }} />
                    <Text style={styles.itemText}>{act.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {filteredFiles.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionHeader}>Files</Text>
                {filteredFiles.map((file, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={styles.itemRow}
                    onPress={() => handleSelectFile(file)}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="document-text-outline" size={15} color="#38bdf8" style={{ marginRight: 8 }} />
                    <Text style={styles.fileText} numberOfLines={1}>
                      {file}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {actions.length === 0 && filteredFiles.length === 0 && (
              <Text style={styles.noResultsText}>No matching files or commands</Text>
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 70 : 40,
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '75%',
    backgroundColor: '#0B192C',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
    overflow: 'hidden',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  searchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 10,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    fontSize: 15,
    fontFamily: FONTS.mono,
  },
  closeBtn: {
    padding: 4,
  },
  resultsScroll: {
    paddingVertical: 8,
  },
  section: {
    marginBottom: 12,
  },
  sectionHeader: {
    color: THEMES.cyberpunk.textDim,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  itemText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  fileText: {
    color: '#cbd5e1',
    fontSize: 13,
    fontFamily: FONTS.mono,
  },
  noResultsText: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    padding: 24,
    fontStyle: 'italic',
  },
});

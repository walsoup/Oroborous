import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';
import BouncyButton from './BouncyButton';

export default function CodeEditor({ filePath, initialContent, onSave, onDiscard, isSaving = false, onContentChange, onDirtyChange }) {
  const [content, setContent] = useState(initialContent || '');
  const [isDirty, setIsDirty] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const textInputRef = useRef(null);
  // Track selection so snippet insertion lands at the caret, not end-of-file
  const selectionRef = useRef({ start: 0, end: 0 });

  useEffect(() => {
    setContent(initialContent || '');
    setIsDirty(false);
    if (onDirtyChange) onDirtyChange(filePath, false);
  }, [initialContent, filePath]);

  const handleChangeText = (text) => {
    setContent(text);
    const dirty = text !== initialContent;
    setIsDirty(dirty);
    onContentChange && onContentChange(filePath, text);
    onDirtyChange && onDirtyChange(filePath, dirty);
  };

  const handleSave = () => {
    if (onSave) {
      onSave(filePath, content);
    }
  };

  const insertSnippet = (snippet) => {
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
    const { start, end } = selectionRef.current;
    const next = content.slice(0, start) + snippet + content.slice(end);
    const caret = start + snippet.length;

    setContent(next);
    setIsDirty(next !== initialContent);
    onContentChange && onContentChange(filePath, next);
    onDirtyChange && onDirtyChange(filePath, next !== initialContent);

    requestAnimationFrame(() => {
      try {
        textInputRef.current?.setSelection(caret, caret);
      } catch (_) {}
    });
  };

  // Derived values memoized so typing doesn't re-split/re-scan the whole buffer
  const lines = useMemo(() => content.split('\n'), [content]);
  const matchCount = useMemo(
    () =>
      searchQuery
        ? lines.filter(l => l.toLowerCase().includes(searchQuery.toLowerCase())).length
        : 0,
    [lines, searchQuery]
  );

  return (
    <View style={styles.container}>
      {/* Editor Top Bar */}
      <View style={styles.topBar}>
        <View style={styles.fileInfo}>
          <Ionicons name="document-text" size={16} color="#00e1ff" />
          <Text style={styles.filePathText} numberOfLines={1} ellipsizeMode="middle">
            {filePath}
          </Text>
          {isDirty && (
            <View style={styles.unsavedBadge}>
              <Text style={styles.unsavedDot}>●</Text>
              <Text style={styles.unsavedText}>Unsaved</Text>
            </View>
          )}
        </View>

        <View style={styles.topActions}>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSearch(prev => !prev)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Find in file"
          >
            <Ionicons name="search" size={16} color={showSearch ? '#00e1ff' : '#94a3b8'} />
          </TouchableOpacity>

          <BouncyButton
            style={[styles.saveBtn, isDirty ? styles.saveBtnActive : styles.saveBtnDisabled]}
            onPress={handleSave}
            disabled={!isDirty || isSaving}
            hapticType="medium"
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#050B14" />
            ) : (
              <>
                <Ionicons name="save-outline" size={14} color={isDirty ? '#050B14' : '#64748b'} />
                <Text style={[styles.saveBtnText, isDirty && styles.saveBtnTextActive]}>Save</Text>
              </>
            )}
          </BouncyButton>
        </View>
      </View>

      {/* Search in File Bar */}
      {showSearch && (
        <View style={styles.searchBar}>
          <Ionicons name="search" size={14} color="#94a3b8" />
          <TextInput
            style={styles.searchInput}
            placeholder="Find in file..."
            placeholderTextColor="#94a3b8"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
          {searchQuery ? (
            <Text style={styles.matchCount}>{matchCount} matches</Text>
          ) : null}
        </View>
      )}

      {/* Code Editor Body */}
      <ScrollView
        style={styles.editorScroll}
        showsVerticalScrollIndicator={true}
        showsHorizontalScrollIndicator={true}
      >
        <View style={styles.editorRow}>
          {/* Gutter / Line Numbers */}
          <View style={styles.gutter}>
            {lines.map((_, i) => (
              <Text key={i} style={styles.lineNumber}>
                {i + 1}
              </Text>
            ))}
          </View>

          {/* Editable Text Area */}
          <View style={styles.textAreaWrapper}>
            <TextInput
              ref={textInputRef}
              style={styles.codeTextInput}
              multiline
              value={content}
              onChangeText={handleChangeText}
              onSelectionChange={(e) => {
                selectionRef.current = e.nativeEvent.selection;
              }}
              autoCapitalize="none"
              autoCorrect={false}
              spellCheck={false}
              keyboardType="default"
              textAlignVertical="top"
              scrollEnabled={false}
            />
          </View>
        </View>
      </ScrollView>

      {/* Quick Snippet Keys Bar */}
      <View style={styles.snippetsBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.snippetsScroll}>
          {['Tab', '()', '{}', '[]', '=>', '===', ';', 'const ', 'import ', 'return ', 'export ', 'async '].map((snip, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.snippetBtn}
              onPress={() => insertSnippet(snip === 'Tab' ? '  ' : snip)}
              hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
            >
              <Text style={styles.snippetText}>{snip.trim()}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#050B14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    marginRight: 10,
  },
  filePathText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: FONTS.mono,
  },
  unsavedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    gap: 4,
  },
  unsavedDot: {
    color: '#f59e0b',
    fontSize: 11,
  },
  unsavedText: {
    color: '#f59e0b',
    fontSize: 11,
    fontWeight: '700',
  },
  topActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    minHeight: 36,
  },
  saveBtnActive: {
    backgroundColor: '#00e1ff',
  },
  saveBtnDisabled: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  saveBtnText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
  },
  saveBtnTextActive: {
    color: '#050B14',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0B192C',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 12,
    fontFamily: FONTS.mono,
    paddingVertical: 4,
  },
  matchCount: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '600',
  },
  editorScroll: {
    flex: 1,
  },
  editorRow: {
    flexDirection: 'row',
    minHeight: '100%',
    paddingBottom: 40,
  },
  gutter: {
    width: 34,
    paddingVertical: 12,
    paddingRight: 8,
    backgroundColor: '#030712',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'flex-end',
  },
  lineNumber: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 20,
    fontFamily: FONTS.mono,
  },
  textAreaWrapper: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  codeTextInput: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 20,
    fontFamily: FONTS.mono,
    padding: 0,
    margin: 0,
  },
  snippetsBar: {
    backgroundColor: '#050B14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 6,
  },
  snippetsScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  snippetBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minHeight: 36,
    justifyContent: 'center',
  },
  snippetText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.mono,
  },
});

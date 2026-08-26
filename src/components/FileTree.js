import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput, Modal, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';
import BouncyButton from './BouncyButton';

const getFileIcon = (fileName, isDir, isExpanded) => {
  if (isDir) {
    return { name: isExpanded ? 'folder-open' : 'folder', color: '#38bdf8' };
  }
  const ext = fileName.split('.').pop().toLowerCase();
  switch (ext) {
    case 'js':
    case 'jsx':
      return { name: 'logo-javascript', color: '#facc15' };
    case 'ts':
    case 'tsx':
      return { name: 'code-slash', color: '#38bdf8' };
    case 'json':
      return { name: 'code-working', color: '#fb923c' };
    case 'md':
      return { name: 'document-text', color: '#c084fc' };
    case 'py':
      return { name: 'logo-python', color: '#34d399' };
    case 'rs':
      return { name: 'construct', color: '#fb7185' };
    case 'html':
    case 'css':
      return { name: 'logo-css3', color: '#60a5fa' };
    case 'png':
    case 'jpg':
    case 'svg':
      return { name: 'image', color: '#a78bfa' };
    default:
      return { name: 'document-outline', color: '#94a3b8' };
  }
};

const pruneTree = (nodes, q) => {
  if (!q) return nodes;
  const out = [];
  for (const node of nodes) {
    if (!node.children) {
      if (node.name.toLowerCase().includes(q)) out.push(node);
    } else {
      const pruned = pruneTree(node.children, q);
      if (pruned.length > 0 || node.name.toLowerCase().includes(q)) {
        out.push({ ...node, children: pruned });
      }
    }
  }
  return out;
};

const TreeNode = React.memo(function TreeNode({ node, level = 0, selectedPath, onSelectFile, expandedFolders, toggleFolder, onContextMenu }) {
  const isDir = node.type === 'directory';
  const isExpanded = expandedFolders[node.path];
  const isSelected = selectedPath === node.path;
  const icon = getFileIcon(node.name, isDir, isExpanded);

  const handlePress = useCallback(() => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isDir) {
      toggleFolder(node.path);
    } else {
      onSelectFile(node.path);
    }
  }, [isDir, node.path, toggleFolder, onSelectFile]);

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.treeItem,
          { paddingLeft: 12 + level * 14 },
          isSelected && styles.treeItemActive
        ]}
        onPress={handlePress}
        onLongPress={() => onContextMenu(node)}
        activeOpacity={0.7}
      >
        <Ionicons name={icon.name} size={15} color={icon.color} style={{ marginRight: 6 }} />
        <Text
          style={[styles.treeItemText, isSelected && styles.treeItemTextActive]}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {node.name}
        </Text>
        {isDir && (
          <Ionicons
            name={isExpanded ? 'chevron-down' : 'chevron-forward'}
            size={12}
            color={THEMES.cyberpunk.textDim}
            style={{ marginLeft: 'auto', marginRight: 8 }}
          />
        )}
      </TouchableOpacity>

      {isDir && isExpanded && node.children && (
        <View>
          {node.children.map((child) => (
            <TreeNode
              key={child.path}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onContextMenu={onContextMenu}
            />
          ))}
        </View>
      )}
    </View>
  );
});

export default function FileTree({ tree = [], selectedPath, onSelectFile, onCreateFile, onCreateDir, onDelete, onRename }) {
  const [expandedFolders, setExpandedFolders] = useState({});
  const [filterText, setFilterText] = useState('');
  const [modalMode, setModalMode] = useState(null); // 'createFile', 'createDir', 'rename'
  const [targetNode, setTargetNode] = useState(null);
  const [inputVal, setInputVal] = useState('');

  const toggleFolder = useCallback((folderPath) => {
    setExpandedFolders(prev => ({ ...prev, [folderPath]: !prev[folderPath] }));
  }, []);

  const handleContextMenu = (node) => {
    setTargetNode(node);
    Alert.alert(
      node.name,
      node.type === 'directory' ? 'Folder Actions' : 'File Actions',
      [
        {
          text: 'Rename',
          onPress: () => {
            setInputVal(node.name);
            setModalMode('rename');
          }
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (onDelete) onDelete(node.path);
          }
        },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleModalSubmit = () => {
    if (!inputVal.trim()) return;
    if (modalMode === 'createFile' && onCreateFile) {
      onCreateFile(inputVal.trim());
    } else if (modalMode === 'createDir' && onCreateDir) {
      onCreateDir(inputVal.trim());
    } else if (modalMode === 'rename' && onRename && targetNode) {
      const parentDir = targetNode.path.includes('/') ? targetNode.path.substring(0, targetNode.path.lastIndexOf('/')) : '';
      const newPath = parentDir ? `${parentDir}/${inputVal.trim()}` : inputVal.trim();
      onRename(targetNode.path, newPath);
    }
    setModalMode(null);
    setInputVal('');
  };

  const query = filterText.trim().toLowerCase();
  const visibleTree = useMemo(() => pruneTree(tree, query), [tree, query]);

  // Auto-expand folders containing filter matches so results are visible
  useEffect(() => {
    if (!query) return;
    const autoExpand = {};
    const walkForMatches = (nodes) => {
      for (const n of nodes) {
        if (n.type === 'directory' && n.children && n.children.length) {
          autoExpand[n.path] = true;
          walkForMatches(n.children);
        }
      }
    };
    walkForMatches(visibleTree);
    setExpandedFolders(prev => ({ ...prev, ...autoExpand }));
  }, [query, visibleTree]);

  return (
    <View style={styles.container}>
      {/* Search & Actions Header */}
      <View style={styles.header}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={13} color={THEMES.cyberpunk.textDim} />
          <TextInput
            style={styles.searchInput}
            placeholder="Filter files..."
            placeholderTextColor={THEMES.cyberpunk.textDim}
            value={filterText}
            onChangeText={setFilterText}
            autoCapitalize="none"
          />
        </View>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => { setInputVal(''); setModalMode('createFile'); }}
        >
          <Ionicons name="add" size={16} color={THEMES.cyberpunk.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerActionBtn}
          onPress={() => { setInputVal(''); setModalMode('createDir'); }}
        >
          <Ionicons name="folder-outline" size={14} color="#38bdf8" />
        </TouchableOpacity>
      </View>

      {/* Tree Content */}
      <ScrollView style={styles.treeScroll} showsVerticalScrollIndicator={true}>
        {visibleTree.length === 0 ? (
          <Text style={styles.emptyText}>
            {query ? 'No files match this filter' : 'No files in workspace'}
          </Text>
        ) : (
          visibleTree.map((node) => (
            <TreeNode
              key={node.path}
              node={node}
              level={0}
              selectedPath={selectedPath}
              onSelectFile={onSelectFile}
              expandedFolders={expandedFolders}
              toggleFolder={toggleFolder}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </ScrollView>

      {/* Action Dialog Modal */}
      <Modal visible={!!modalMode} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {modalMode === 'createFile' ? 'New File' : modalMode === 'createDir' ? 'New Directory' : 'Rename'}
            </Text>
            <TextInput
              style={styles.modalInput}
              placeholder={modalMode === 'createFile' ? 'e.g. src/utils/helpers.js' : 'e.g. components'}
              placeholderTextColor={THEMES.cyberpunk.textDim}
              value={inputVal}
              onChangeText={setInputVal}
              autoCapitalize="none"
              autoFocus
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setModalMode(null)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <BouncyButton style={styles.modalConfirmBtn} onPress={handleModalSubmit}>
                <Text style={styles.modalConfirmText}>Confirm</Text>
              </BouncyButton>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    gap: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    paddingHorizontal: 8,
    borderRadius: 8,
    gap: 4,
  },
  searchInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 11,
    fontFamily: FONTS.mono,
    paddingVertical: 4,
  },
  headerActionBtn: {
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  treeScroll: {
    flex: 1,
    paddingVertical: 6,
  },
  treeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingRight: 8,
  },
  treeItemActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
  },
  treeItemText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  treeItemTextActive: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  emptyText: {
    color: '#64748b',
    fontSize: 12,
    fontStyle: 'italic',
    padding: 16,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#0B192C',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalInput: {
    backgroundColor: '#050B14',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.mono,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.3)',
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  modalCancelText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
  },
  modalConfirmBtn: {
    backgroundColor: '#00e1ff',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  modalConfirmText: {
    color: '#050B14',
    fontSize: 13,
    fontWeight: '700',
  },
});

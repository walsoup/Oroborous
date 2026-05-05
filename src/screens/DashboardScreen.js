import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';

export default function DashboardScreen({ navigation }) {
  const [repoLink, setRepoLink] = useState('');
  const [repos, setRepos] = useState([
    { id: '1', name: 'oroborous-ide', status: 'Synced' },
    { id: '2', name: 'awesome-react-native', status: 'Synced' },
  ]);

  const handleSync = () => {
    if (repoLink.trim()) {
      setRepos([{ id: Date.now().toString(), name: repoLink.split('/').pop() || 'new-repo', status: 'Syncing...' }, ...repos]);
      setRepoLink('');
    }
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate('Workspace', { repo: item })}>
      <GlassContainer style={styles.repoCard}>
        <View style={styles.repoInfo}>
          <Ionicons name="folder-outline" size={24} color="#e2e8f0" />
          <View style={styles.repoTextContainer}>
            <Text style={styles.repoName}>{item.name}</Text>
            <Text style={styles.repoStatus}>{item.status}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
      </GlassContainer>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Your Workspaces</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Settings')}>
          <Ionicons name="settings-outline" size={24} color="#e2e8f0" />
        </TouchableOpacity>
      </View>

      <GlassContainer style={styles.syncContainer}>
        <Text style={styles.syncLabel}>Sync a new repository</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Paste GitHub URL..."
            placeholderTextColor="#64748b"
            value={repoLink}
            onChangeText={setRepoLink}
          />
          <TouchableOpacity style={styles.syncButton} onPress={handleSync}>
            <Ionicons name="cloud-download-outline" size={20} color="#0f172a" />
          </TouchableOpacity>
        </View>
      </GlassContainer>

      <FlatList
        data={repos}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContainer}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  syncContainer: {
    marginBottom: 24,
    padding: 16,
  },
  syncLabel: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 12,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  syncButton: {
    backgroundColor: '#22d3ee',
    borderRadius: 8,
    width: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    gap: 16,
    paddingBottom: 20,
  },
  repoCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  repoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  repoTextContainer: {
    justifyContent: 'center',
  },
  repoName: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  repoStatus: {
    color: '#94a3b8',
    fontSize: 12,
  },
});

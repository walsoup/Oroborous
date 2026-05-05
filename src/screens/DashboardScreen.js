import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';

export default function DashboardScreen({ navigation }) {
  const [repoLink, setRepoLink] = useState('');
  const [repos, setRepos] = useState([
    { id: '1', name: 'oroborous-ide', status: 'Synced', branches: 4, lastActive: '2m ago' },
    { id: '2', name: 'awesome-react-native', status: 'Synced', branches: 1, lastActive: '1h ago' },
  ]);

  const handleSync = () => {
    if (repoLink.trim()) {
      setRepos([{
        id: Date.now().toString(),
        name: repoLink.split('/').pop() || 'new-repo',
        status: 'Syncing...',
        branches: 0,
        lastActive: 'just now'
      }, ...repos]);
      setRepoLink('');
    }
  };

  const renderItem = ({ item, index }) => (
    <FadeIn delay={100 * index}>
      <TouchableOpacity onPress={() => navigation.navigate('Workspace', { repo: item })} activeOpacity={0.8}>
        <GlassContainer style={styles.repoCard}>
          <View style={styles.repoHeader}>
            <View style={styles.repoTitleRow}>
              <Ionicons name="git-network-outline" size={24} color="#00e1ff" />
              <Text style={styles.repoName}>{item.name}</Text>
            </View>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{item.branches} branch{item.branches !== 1 ? 'es' : ''}</Text>
            </View>
          </View>

          <View style={styles.repoFooter}>
            <Text style={styles.repoStatus}>{item.status}</Text>
            <Text style={styles.repoActive}>Active {item.lastActive}</Text>
          </View>
        </GlassContainer>
      </TouchableOpacity>
    </FadeIn>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <FadeIn delay={0}>
          <Text style={styles.title}>Workspaces</Text>
        </FadeIn>
        <FadeIn delay={50}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color="#e2e8f0" />
          </TouchableOpacity>
        </FadeIn>
      </View>

      <FadeIn delay={100}>
        <GlassContainer style={styles.syncContainer}>
          <Text style={styles.syncLabel}>Clone Repository</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="https://github.com/user/repo"
              placeholderTextColor="#64748b"
              value={repoLink}
              onChangeText={setRepoLink}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity style={styles.syncButton} onPress={handleSync} activeOpacity={0.8}>
              <Ionicons name="cloud-download-outline" size={20} color="#0B192C" />
            </TouchableOpacity>
          </View>
        </GlassContainer>
      </FadeIn>

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
    backgroundColor: '#050B14',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 10,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  settingsBtn: {
    padding: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  syncContainer: {
    marginBottom: 24,
  },
  syncLabel: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.3)',
    fontSize: 15,
  },
  syncButton: {
    backgroundColor: '#00e1ff',
    borderRadius: 12,
    width: 52,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  listContainer: {
    gap: 16,
    paddingBottom: 40,
  },
  repoCard: {
    padding: 0,
  },
  repoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  repoTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  repoName: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '700',
    flexShrink: 1,
  },
  badge: {
    backgroundColor: 'rgba(0, 225, 255, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.3)',
  },
  badgeText: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '700',
  },
  repoFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    paddingTop: 12,
  },
  repoStatus: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '500',
  },
  repoActive: {
    color: '#64748b',
    fontSize: 13,
  },
});

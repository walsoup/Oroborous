import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import { api, getServerUrl, setServerUrl } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';

export default function DashboardScreen({ navigation }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeGitStatus, setActiveGitStatus] = useState(null);
  
  const [actionTab, setActionTab] = useState('local'); // 'local' or 'clone'
  const [dirPath, setDirPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  
  const [backendUrl, setBackendUrl] = useState(getServerUrl());
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const checkConnectionAndLoad = async () => {
    setLoading(true);
    try {
      await api.getHealth();
      setIsBackendConnected(true);
      
      // Load config & workspaces
      const config = await api.getConfig();
      setWorkspaces(config.workspaces || []);
      setActiveWorkspaceId(config.activeWorkspaceId);
      
      // Load git status if active workspace exists
      if (config.activeWorkspaceId) {
        try {
          const gitStatus = await api.getGitStatus();
          setActiveGitStatus(gitStatus);
        } catch (e) {
          setActiveGitStatus(null);
        }
      } else {
        setActiveGitStatus(null);
      }
    } catch (error) {
      setIsBackendConnected(false);
      setWorkspaces([]);
      setActiveGitStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      checkConnectionAndLoad();
    }, [backendUrl])
  );

  const handleUpdateBackendUrl = () => {
    setServerUrl(backendUrl);
    checkConnectionAndLoad();
  };

  const handleSelectWorkspace = async () => {
    if (!dirPath.trim()) {
      Alert.alert('Error', 'Please enter a directory path');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.selectWorkspace(dirPath.trim());
      setWorkspaces(res.workspaces);
      setActiveWorkspaceId(res.activeWorkspaceId);
      setDirPath('');
      Alert.alert('Success', 'Workspace added successfully');
      checkConnectionAndLoad();
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to select workspace');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloneRepo = async () => {
    if (!repoUrl.trim()) {
      Alert.alert('Error', 'Please enter a repository URL');
      return;
    }
    setActionLoading(true);
    try {
      const res = await api.cloneWorkspace(repoUrl.trim(), targetDir.trim() || undefined);
      setRepoUrl('');
      setTargetDir('');
      Alert.alert('Cloning Started', 'The repository is being cloned in the background. It will appear in your workspaces list once completed.');
      
      // Poll workspaces list for a few seconds
      let attempts = 0;
      const interval = setInterval(async () => {
        attempts++;
        try {
          const config = await api.getConfig();
          setWorkspaces(config.workspaces || []);
          if (config.activeWorkspaceId !== activeWorkspaceId || attempts > 10) {
            clearInterval(interval);
            checkConnectionAndLoad();
          }
        } catch (e) {
          clearInterval(interval);
        }
      }, 2000);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to initiate clone');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateWorkspace = async (id) => {
    try {
      await api.activateWorkspace(id);
      setActiveWorkspaceId(id);
      
      // Fetch git status
      try {
        const gitStatus = await api.getGitStatus();
        setActiveGitStatus(gitStatus);
      } catch (e) {
        setActiveGitStatus(null);
      }
      
      // Navigate to Workspace Screen
      const ws = workspaces.find(w => w.id === id);
      navigation.navigate('Workspace', { workspace: ws });
    } catch (e) {
      Alert.alert('Error', 'Failed to activate workspace');
    }
  };

  const handleDeleteWorkspace = async (id, name) => {
    Alert.alert(
      'Remove Workspace',
      `Are you sure you want to remove "${name}" from your saved list? This will NOT delete the actual folder on your disk.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.deleteWorkspace(id);
              setWorkspaces(res.workspaces);
              if (activeWorkspaceId === id) {
                setActiveWorkspaceId(null);
                setActiveGitStatus(null);
              }
            } catch (e) {
              Alert.alert('Error', 'Failed to remove workspace');
            }
          }
        }
      ]
    );
  };

  const renderWorkspaceItem = ({ item }) => {
    const isActive = item.id === activeWorkspaceId;
    return (
      <FadeIn delay={100} style={styles.workspaceCardContainer}>
        <TouchableOpacity 
          onPress={() => handleActivateWorkspace(item.id)} 
          activeOpacity={0.8}
          style={styles.cardTouch}
        >
          <GlassContainer style={[styles.workspaceCard, isActive && styles.activeCardBorder]} intensity={isActive ? 60 : 30}>
            <View style={styles.cardHeader}>
              <View style={styles.cardTitleRow}>
                <Ionicons name="folder-open" size={22} color={isActive ? '#00e1ff' : '#94a3b8'} />
                <Text style={[styles.workspaceName, isActive && styles.activeText]}>{item.name}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDeleteWorkspace(item.id, item.name)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
            <Text style={styles.workspacePath} numberOfLines={1}>{item.path}</Text>
            {isActive && activeGitStatus?.isGit && (
              <View style={styles.gitStatusBadgeRow}>
                <View style={styles.gitBranchBadge}>
                  <Ionicons name="git-branch" size={12} color="#00e1ff" />
                  <Text style={styles.gitBranchText}>{activeGitStatus.branch}</Text>
                </View>
                {activeGitStatus.ahead > 0 && (
                  <View style={[styles.gitCountBadge, styles.gitAhead]}>
                    <Ionicons name="arrow-up" size={12} color="#4ade80" />
                    <Text style={styles.gitCountText}>{activeGitStatus.ahead} ahead</Text>
                  </View>
                )}
                {activeGitStatus.behind > 0 && (
                  <View style={[styles.gitCountBadge, styles.gitBehind]}>
                    <Ionicons name="arrow-down" size={12} color="#f87171" />
                    <Text style={styles.gitCountText}>{activeGitStatus.behind} behind</Text>
                  </View>
                )}
              </View>
            )}
          </GlassContainer>
        </TouchableOpacity>
      </FadeIn>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <FadeIn delay={0}>
          <Text style={styles.title}>Oroborous</Text>
          <Text style={styles.subtitle}>Agentic IDE Dashboard</Text>
        </FadeIn>
        <FadeIn delay={50}>
          <TouchableOpacity onPress={() => navigation.navigate('Settings')} style={styles.settingsBtn}>
            <Ionicons name="settings-outline" size={22} color="#e2e8f0" />
          </TouchableOpacity>
        </FadeIn>
      </View>

      {/* Backend Connection Check */}
      {!isBackendConnected ? (
        <FadeIn delay={100} style={styles.connectionWarning}>
          <GlassContainer style={styles.warningCard} intensity={40}>
            <View style={styles.warningHeader}>
              <Ionicons name="warning-outline" size={24} color="#f59e0b" />
              <Text style={styles.warningTitle}>Backend Offline</Text>
            </View>
            <Text style={styles.warningDesc}>
              Please make sure the Node.js backend is running (`make start` or `node server/index.js`).
            </Text>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={backendUrl}
                onChangeText={setBackendUrl}
                placeholder="http://localhost:3000"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.connectBtn} onPress={handleUpdateBackendUrl}>
                <Text style={styles.connectBtnText}>Connect</Text>
              </TouchableOpacity>
            </View>
          </GlassContainer>
        </FadeIn>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Active Workspace / Git Overview */}
          {activeWorkspaceId && activeGitStatus && (
            <FadeIn delay={150} style={styles.overviewSection}>
              <GlassContainer style={styles.overviewCard} intensity={50}>
                <Text style={styles.sectionLabel}>Active Repository Status</Text>
                <View style={styles.gitRepoHeader}>
                  <Text style={styles.gitRepoName}>
                    {workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Active Workspace'}
                  </Text>
                  <View style={styles.branchWrapper}>
                    <Ionicons name="git-branch" size={16} color="#00e1ff" />
                    <Text style={styles.branchName}>{activeGitStatus.branch || 'main'}</Text>
                  </View>
                </View>

                <View style={styles.statsGrid}>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Commits Ahead</Text>
                    <Text style={[styles.statValue, activeGitStatus.ahead > 0 ? styles.positiveText : null]}>
                      {activeGitStatus.ahead}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Commits Behind</Text>
                    <Text style={[styles.statValue, activeGitStatus.behind > 0 ? styles.negativeText : null]}>
                      {activeGitStatus.behind}
                    </Text>
                  </View>
                  <View style={styles.statBox}>
                    <Text style={styles.statLabel}>Git Status</Text>
                    <Text style={[styles.statValue, styles.infoText]}>
                      {activeGitStatus.isGit ? 'Git Ready' : 'Non-Git'}
                    </Text>
                  </View>
                </View>

                {activeGitStatus.statusShort ? (
                  <View style={styles.modifiedFilesSection}>
                    <Text style={styles.modifiedTitle}>Modified Files:</Text>
                    <Text style={styles.modifiedList} numberOfLines={5}>
                      {activeGitStatus.statusShort}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.cleanWorkingTree}>Working tree clean</Text>
                )}

                <TouchableOpacity 
                  style={styles.openWorkspaceBtn} 
                  onPress={() => navigation.navigate('Workspace', { 
                    workspace: workspaces.find(w => w.id === activeWorkspaceId) 
                  })}
                >
                  <Text style={styles.openWorkspaceBtnText}>Open IDE Workspace</Text>
                  <Ionicons name="arrow-forward" size={16} color="#050B14" />
                </TouchableOpacity>
              </GlassContainer>
            </FadeIn>
          )}

          {/* Action Tabs */}
          <FadeIn delay={200}>
            <View style={styles.tabHeader}>
              <TouchableOpacity 
                style={[styles.tabButton, actionTab === 'local' && styles.activeTabButton]} 
                onPress={() => setActionTab('local')}
              >
                <Ionicons name="folder-outline" size={18} color={actionTab === 'local' ? '#00e1ff' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, actionTab === 'local' && styles.activeTabButtonText]}>Add Local Folder</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.tabButton, actionTab === 'clone' && styles.activeTabButton]} 
                onPress={() => setActionTab('clone')}
              >
                <Ionicons name="cloud-download-outline" size={18} color={actionTab === 'clone' ? '#00e1ff' : '#94a3b8'} />
                <Text style={[styles.tabButtonText, actionTab === 'clone' && styles.activeTabButtonText]}>Clone Git Repo</Text>
              </TouchableOpacity>
            </View>

            <GlassContainer style={styles.actionContainer} intensity={40}>
              {actionTab === 'local' ? (
                <View>
                  <Text style={styles.actionLabel}>Select Local Workspace Directory</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="/absolute/path/to/your/project"
                      placeholderTextColor="#64748b"
                      value={dirPath}
                      onChangeText={setDirPath}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity 
                      style={styles.actionSubmitBtn} 
                      onPress={handleSelectWorkspace} 
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#050B14" />
                      ) : (
                        <Ionicons name="add" size={24} color="#050B14" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.actionLabel}>Git Repository URL</Text>
                  <TextInput
                    style={[styles.input, { marginBottom: 12 }]}
                    placeholder="https://github.com/username/repo.git"
                    placeholderTextColor="#64748b"
                    value={repoUrl}
                    onChangeText={setRepoUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <Text style={styles.actionLabel}>Target Folder Name / Path (Optional)</Text>
                  <View style={styles.inputRow}>
                    <TextInput
                      style={styles.input}
                      placeholder="e.g. my-cloned-app (defaults to repo name)"
                      placeholderTextColor="#64748b"
                      value={targetDir}
                      onChangeText={setTargetDir}
                      autoCapitalize="none"
                      autoCorrect={false}
                    />
                    <TouchableOpacity 
                      style={styles.actionSubmitBtn} 
                      onPress={handleCloneRepo} 
                      disabled={actionLoading}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#050B14" />
                      ) : (
                        <Ionicons name="download-outline" size={22} color="#050B14" />
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </GlassContainer>
          </FadeIn>

          {/* Workspaces List */}
          <FadeIn delay={250} style={styles.listSection}>
            <Text style={styles.sectionTitle}>Saved Workspaces</Text>
            {workspaces.length === 0 ? (
              <Text style={styles.emptyText}>No workspaces saved. Add a local folder or clone a repo above.</Text>
            ) : (
              <FlatList
                data={workspaces}
                keyExtractor={(item) => item.id}
                renderItem={renderWorkspaceItem}
                scrollEnabled={false}
                contentContainerStyle={styles.listGap}
              />
            )}
          </FadeIn>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  settingsBtn: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  connectionWarning: {
    marginTop: 20,
  },
  warningCard: {
    padding: 20,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  warningTitle: {
    color: '#f59e0b',
    fontSize: 18,
    fontWeight: '700',
  },
  warningDesc: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  urlInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    fontSize: 14,
  },
  connectBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectBtnText: {
    color: '#050B14',
    fontWeight: '700',
    fontSize: 14,
  },
  overviewSection: {
    marginBottom: 20,
  },
  overviewCard: {
    padding: 20,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  gitRepoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  gitRepoName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
    flex: 1,
    marginRight: 10,
  },
  branchWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  branchName: {
    color: '#00e1ff',
    fontSize: 13,
    fontWeight: '700',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  statLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  positiveText: {
    color: '#4ade80',
  },
  negativeText: {
    color: '#f87171',
  },
  infoText: {
    color: '#38bdf8',
  },
  modifiedFilesSection: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  modifiedTitle: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  modifiedList: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  cleanWorkingTree: {
    color: '#4ade80',
    fontSize: 13,
    fontWeight: '600',
    fontStyle: 'italic',
    textAlign: 'center',
    marginBottom: 16,
  },
  openWorkspaceBtn: {
    backgroundColor: '#00e1ff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  openWorkspaceBtnText: {
    color: '#050B14',
    fontSize: 15,
    fontWeight: '800',
  },
  tabHeader: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 10,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  activeTabButton: {
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    borderColor: 'rgba(0, 225, 255, 0.3)',
  },
  tabButtonText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '700',
  },
  activeTabButtonText: {
    color: '#00e1ff',
  },
  actionContainer: {
    marginBottom: 24,
    padding: 16,
  },
  actionLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: 14,
  },
  actionSubmitBtn: {
    backgroundColor: '#00e1ff',
    borderRadius: 12,
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
  listSection: {
    marginBottom: 40,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emptyText: {
    color: '#64748b',
    fontSize: 14,
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 10,
  },
  listGap: {
    gap: 12,
  },
  workspaceCardContainer: {
    marginBottom: 12,
  },
  cardTouch: {
    borderRadius: 24,
  },
  workspaceCard: {
    padding: 16,
  },
  activeCardBorder: {
    borderColor: 'rgba(0, 225, 255, 0.4)',
    borderWidth: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  workspaceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  activeText: {
    color: '#ffffff',
  },
  deleteBtn: {
    padding: 4,
  },
  workspacePath: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 10,
    paddingLeft: 30,
  },
  gitStatusBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    paddingLeft: 30,
  },
  gitBranchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  gitBranchText: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '700',
  },
  gitCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
  },
  gitAhead: {
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderColor: 'rgba(74, 222, 128, 0.2)',
  },
  gitBehind: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  gitCountText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
});

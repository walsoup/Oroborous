import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import { api, getServerUrl, setServerUrl } from '../services/api';
import { useFocusEffect } from '@react-navigation/native';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function DashboardScreen({ navigation }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(null);
  const [activeGitStatus, setActiveGitStatus] = useState(null);
  const [projectInfo, setProjectInfo] = useState(null);

  const [actionTab, setActionTab] = useState('local'); // 'local' | 'clone'
  const [dirPath, setDirPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [targetDir, setTargetDir] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [backendUrl, setBackendUrl] = useState(getServerUrl());
  const [isBackendConnected, setIsBackendConnected] = useState(false);
  const [authRequired, setAuthRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Clone status poller — keep a ref so it never outlives the screen
  const clonePollRef = useRef(null);

  useEffect(() => {
    return () => {
      if (clonePollRef.current) clearInterval(clonePollRef.current);
    };
  }, []);

  const checkConnectionAndLoad = async () => {
    setLoading(true);
    try {
      await api.getHealth();
      setIsBackendConnected(true);

      try {
        const config = await api.getConfig();
        setWorkspaces(config.workspaces || []);
        setActiveWorkspaceId(config.activeWorkspaceId);
        setAuthRequired(false);

        if (config.activeWorkspaceId) {
          try {
            const [gitStatus, proj] = await Promise.all([
              api.getGitStatus(),
              api.getProjectInfo()
            ]);
            setActiveGitStatus(gitStatus);
            setProjectInfo(proj);
          } catch (_) {}
        }
      } catch (cfgErr) {
        // Server is up but rejected our token
        if (/unauthorized|token/i.test(cfgErr.message || '')) {
          setAuthRequired(true);
          setIsBackendConnected(false);
        }
      }
    } catch (error) {
      setIsBackendConnected(false);
    } finally {
      setLoading(false);
    }
  };

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
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
      Alert.alert('Error', 'Please enter a git repository URL');
      return;
    }
    setActionLoading(true);
    try {
      await api.cloneWorkspace(repoUrl.trim(), targetDir.trim() || undefined);
      setRepoUrl('');
      setTargetDir('');
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Cloning Started', 'Repository is cloning in the background. It will appear once finished.');

      let attempts = 0;
      if (clonePollRef.current) clearInterval(clonePollRef.current);
      clonePollRef.current = setInterval(async () => {
        attempts++;
        try {
          const config = await api.getConfig();
          setWorkspaces(config.workspaces || []);
          // Use functional read of latest active id via config comparison only
          if (attempts > 8) {
            clearInterval(clonePollRef.current);
            clonePollRef.current = null;
            checkConnectionAndLoad();
          }
        } catch (_) {
          clearInterval(clonePollRef.current);
          clonePollRef.current = null;
        }
      }, 2000);
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to initiate clone');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivateWorkspace = async (id) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      await api.activateWorkspace(id);
      setActiveWorkspaceId(id);
      const ws = workspaces.find(w => w.id === id);
      navigation.navigate('Workspace', { workspace: ws });
    } catch (e) {
      Alert.alert('Error', 'Failed to activate workspace');
    }
  };

  const handleDeleteWorkspace = (id, name) => {
    Alert.alert(
      'Remove Workspace',
      `Remove "${name}" from saved list? (Does not delete actual files on disk)`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await api.deleteWorkspace(id);
              setWorkspaces(res.workspaces);
              if (activeWorkspaceId === id) setActiveWorkspaceId(null);
            } catch (e) {
              Alert.alert('Error', 'Failed to remove workspace');
            }
          }
        }
      ]
    );
  };

  const filteredWorkspaces = workspaces.filter(w =>
    !searchQuery || w.name.toLowerCase().includes(searchQuery.toLowerCase()) || w.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>🐍 Oroborous</Text>
          <Text style={styles.subtitle}>Autonomous Agentic IDE</Text>
        </View>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('Settings')}
            accessibilityLabel="settings"
          >
            <Ionicons name="settings-sharp" size={20} color="#00e1ff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Backend Status Warning if Offline */}
      {!isBackendConnected ? (
        <FadeIn delay={50} style={styles.connectionWarning}>
          <GlassContainer style={styles.warningCard} intensity={40}>
            <View style={styles.warningHeader}>
              <Ionicons name="cloud-offline" size={22} color="#f59e0b" />
              <Text style={styles.warningTitle}>
                {authRequired ? 'Pairing Token Required' : 'Backend Server Offline'}
              </Text>
            </View>
            <Text style={styles.warningDesc}>
              {authRequired
                ? 'The server rejected your token. Paste the "Pairing token" printed in the server console (Settings → Server Pairing Token), then reconnect.'
                : 'Make sure the Node.js server is running (`node server/index.js`).'}
            </Text>
            <View style={styles.urlInputRow}>
              <TextInput
                style={styles.urlInput}
                value={backendUrl}
                onChangeText={setBackendUrl}
                placeholder="http://localhost:3005"
                placeholderTextColor="#94a3b8"
                autoCapitalize="none"
              />
              <BouncyButton style={styles.connectBtn} onPress={handleUpdateBackendUrl}>
                <Text style={styles.connectBtnText}>Connect</Text>
              </BouncyButton>
            </View>
          </GlassContainer>
        </FadeIn>
      ) : (
        <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Active Workspace Quick Launch Card */}
          {activeWorkspaceId && activeGitStatus && (
            <FadeIn delay={100} style={styles.overviewSection}>
              <GlassContainer style={styles.overviewCard} intensity={50}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.sectionLabel}>Active Workspace</Text>
                  <View style={styles.branchPill}>
                    <Ionicons name="git-branch" size={12} color="#00e1ff" />
                    <Text style={styles.branchPillText}>{activeGitStatus.branch || 'main'}</Text>
                  </View>
                </View>

                <Text style={styles.activeRepoName}>
                  {workspaces.find(w => w.id === activeWorkspaceId)?.name || 'Active Workspace'}
                </Text>
                <Text style={styles.activeRepoPath} numberOfLines={1}>
                  {workspaces.find(w => w.id === activeWorkspaceId)?.path}
                </Text>

                <View style={styles.metricsGrid}>
                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Ahead / Behind</Text>
                    <Text style={styles.metricValue}>
                      <Text style={{ color: '#4ade80' }}>+{activeGitStatus.ahead || 0}</Text> / <Text style={{ color: '#f87171' }}>-{activeGitStatus.behind || 0}</Text>
                    </Text>
                  </View>

                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Changes</Text>
                    <Text style={[styles.metricValue, { color: activeGitStatus.totalChanges > 0 ? '#38bdf8' : '#4ade80' }]}>
                      {activeGitStatus.totalChanges > 0 ? `${activeGitStatus.totalChanges} files` : 'Clean'}
                    </Text>
                  </View>

                  <View style={styles.metricBox}>
                    <Text style={styles.metricLabel}>Stack</Text>
                    <Text style={[styles.metricValue, { color: '#c084fc' }]}>
                      {projectInfo?.frameworks?.[0] || 'Generic'}
                    </Text>
                  </View>
                </View>

                <BouncyButton
                  style={styles.launchBtn}
                  onPress={() => navigation.navigate('Workspace', {
                    workspace: workspaces.find(w => w.id === activeWorkspaceId)
                  })}
                  hapticType="medium"
                >
                  <Text style={styles.launchBtnText}>Launch IDE Studio</Text>
                  <Ionicons name="arrow-forward" size={16} color="#050B14" />
                </BouncyButton>
              </GlassContainer>
            </FadeIn>
          )}

          {/* Add / Clone Workspace Actions */}
          <FadeIn delay={150}>
            <View style={styles.actionTabRow}>
              <TouchableOpacity
                style={[styles.actionTabBtn, actionTab === 'local' && styles.actionTabBtnActive]}
                onPress={() => setActionTab('local')}
              >
                <Ionicons name="folder-open" size={16} color={actionTab === 'local' ? '#00e1ff' : '#94a3b8'} />
                <Text style={[styles.actionTabText, actionTab === 'local' && styles.actionTabTextActive]}>Add Local Folder</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionTabBtn, actionTab === 'clone' && styles.actionTabBtnActive]}
                onPress={() => setActionTab('clone')}
              >
                <Ionicons name="cloud-download" size={16} color={actionTab === 'clone' ? '#00e1ff' : '#94a3b8'} />
                <Text style={[styles.actionTabText, actionTab === 'clone' && styles.actionTabTextActive]}>Clone Git Repo</Text>
              </TouchableOpacity>
            </View>

            <GlassContainer style={styles.actionCard} intensity={40}>
              {actionTab === 'local' ? (
                <View>
                  <Text style={styles.inputLabel}>Absolute Directory Path</Text>
                  <View style={styles.inputWithBtnRow}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="/path/to/project or C:\projects\my-app"
                      placeholderTextColor="#94a3b8"
                      value={dirPath}
                      onChangeText={setDirPath}
                      autoCapitalize="none"
                    />
                    <BouncyButton
                      style={styles.addBtn}
                      onPress={handleSelectWorkspace}
                      disabled={actionLoading || !dirPath.trim()}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#050B14" />
                      ) : (
                        <Ionicons name="add" size={20} color="#050B14" />
                      )}
                    </BouncyButton>
                  </View>
                </View>
              ) : (
                <View>
                  <Text style={styles.inputLabel}>Git Clone URL</Text>
                  <TextInput
                    style={[styles.cardInput, { marginBottom: 10 }]}
                    placeholder="https://github.com/user/repo.git"
                    placeholderTextColor="#94a3b8"
                    value={repoUrl}
                    onChangeText={setRepoUrl}
                    autoCapitalize="none"
                  />
                  <Text style={styles.inputLabel}>Target Folder (Optional)</Text>
                  <View style={styles.inputWithBtnRow}>
                    <TextInput
                      style={styles.cardInput}
                      placeholder="e.g. my-cloned-app"
                      placeholderTextColor="#94a3b8"
                      value={targetDir}
                      onChangeText={setTargetDir}
                      autoCapitalize="none"
                    />
                    <BouncyButton
                      style={styles.addBtn}
                      onPress={handleCloneRepo}
                      disabled={actionLoading || !repoUrl.trim()}
                    >
                      {actionLoading ? (
                        <ActivityIndicator size="small" color="#050B14" />
                      ) : (
                        <Ionicons name="download" size={18} color="#050B14" />
                      )}
                    </BouncyButton>
                  </View>
                </View>
              )}
            </GlassContainer>
          </FadeIn>

          {/* Workspaces List Section */}
          <FadeIn delay={200} style={styles.workspacesSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionHeading}>Your Workspaces ({workspaces.length})</Text>
              {workspaces.length > 3 && (
                <TextInput
                  style={styles.listFilterInput}
                  placeholder="Filter..."
                  placeholderTextColor="#94a3b8"
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                />
              )}
            </View>

            {filteredWorkspaces.length === 0 ? (
              <Text style={styles.emptyListText}>No saved workspaces found. Add one above to get started!</Text>
            ) : (
              filteredWorkspaces.map(item => {
                const isActive = item.id === activeWorkspaceId;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.workspaceCardTouch}
                    onPress={() => handleActivateWorkspace(item.id)}
                    activeOpacity={0.8}
                    accessibilityLabel="workspace-card"
                  >
                    <GlassContainer style={[styles.workspaceCard, isActive && styles.activeWorkspaceCard]} intensity={isActive ? 60 : 30}>
                      <View style={styles.wsHeaderRow}>
                        <View style={styles.wsTitleRow}>
                          <Ionicons name="folder-open" size={18} color={isActive ? '#00e1ff' : '#94a3b8'} />
                          <Text style={[styles.wsTitle, isActive && styles.wsTitleActive]}>{item.name}</Text>
                        </View>
                        <TouchableOpacity
                          style={styles.deleteWsBtn}
                          onPress={() => handleDeleteWorkspace(item.id, item.name)}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove workspace ${item.name}`}
                        >
                          <Ionicons name="trash-outline" size={18} color="#f87171" />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.wsPath} numberOfLines={1}>{item.path}</Text>
                    </GlassContainer>
                  </TouchableOpacity>
                );
              })
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  scrollContent: {
    flex: 1,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingTop: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  settingsBtn: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  connectionWarning: {
    marginTop: 16,
  },
  warningCard: {
    padding: 16,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  warningTitle: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '700',
  },
  warningDesc: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  urlInputRow: {
    flexDirection: 'row',
    gap: 8,
  },
  urlInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.mono,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  connectBtn: {
    backgroundColor: '#f59e0b',
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  connectBtnText: {
    color: '#050B14',
    fontWeight: '800',
    fontSize: 13,
  },
  overviewSection: {
    marginBottom: 16,
  },
  overviewCard: {
    padding: 16,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
  },
  branchPillText: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  activeRepoName: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    marginBottom: 2,
  },
  activeRepoPath: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: FONTS.mono,
    marginBottom: 14,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metricBox: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderRadius: 10,
    padding: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  metricLabel: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: FONTS.mono,
    fontVariant: ['tabular-nums'],
  },
  launchBtn: {
    backgroundColor: '#00e1ff',
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  launchBtnText: {
    color: '#050B14',
    fontSize: 14,
    fontWeight: '900',
  },
  actionTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  actionTabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 6,
  },
  actionTabBtnActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    borderColor: 'rgba(0, 225, 255, 0.3)',
  },
  actionTabText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  actionTabTextActive: {
    color: '#00e1ff',
  },
  actionCard: {
    padding: 14,
    marginBottom: 20,
  },
  inputLabel: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  inputWithBtnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  cardInput: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.mono,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  addBtn: {
    backgroundColor: '#00e1ff',
    borderRadius: 10,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  workspacesSection: {
    marginBottom: 30,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeading: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  listFilterInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    color: '#ffffff',
    fontSize: 12,
    width: 100,
  },
  workspaceCardTouch: {
    marginBottom: 10,
  },
  workspaceCard: {
    padding: 14,
  },
  activeWorkspaceCard: {
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.4)',
  },
  wsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  wsTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  wsTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#cbd5e1',
  },
  wsTitleActive: {
    color: '#ffffff',
  },
  deleteWsBtn: {
    padding: 12,
    marginRight: -8,
  },
  wsPath: {
    fontSize: 11,
    color: '#64748b',
    fontFamily: FONTS.mono,
    paddingLeft: 24,
  },
  emptyListText: {
    color: '#94a3b8',
    fontSize: 13,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 20,
  },
});

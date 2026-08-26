import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import CodeEditor from '../components/CodeEditor';
import FileTree from '../components/FileTree';
import DiffViewer from '../components/DiffViewer';
import TerminalKeyBar from '../components/TerminalKeyBar';
import GoalTracker from '../components/GoalTracker';
import ActionDeck from '../components/ActionDeck';
import CommandPalette from '../components/CommandPalette';
import { api } from '../services/api';
import { runAgentTask, stopAgent, stopAllAgents } from '../services/agent';
import { THEMES, FONTS, SPRINGS } from '../theme/theme';
import * as Haptics from 'expo-haptics';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';

export default function WorkspaceScreen({ route, navigation }) {
  const workspace = route.params?.workspace;
  const repoName = workspace?.name || 'Workspace';
  const workspacePath = workspace?.path;

  // Active Main Tab: 'agent' | 'editor' | 'git' | 'terminal'
  const [activeTab, setActiveTab] = useState('agent');
  const [containerWidth, setContainerWidth] = useState(0);

  // Tab indicator animation
  const tabWidth = containerWidth ? (containerWidth - 24) / 4 : 0;
  const tabWidthValue = useSharedValue(0);
  const activeTabValue = useSharedValue(0);

  useEffect(() => {
    tabWidthValue.value = tabWidth;
  }, [tabWidth]);

  useEffect(() => {
    const tabIndex = activeTab === 'agent' ? 0 : activeTab === 'editor' ? 1 : activeTab === 'git' ? 2 : 3;
    activeTabValue.value = withSpring(tabIndex, SPRINGS.snappy);
  }, [activeTab]);

  const animatedIndicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: activeTabValue.value * tabWidthValue.value + 12 }],
    width: tabWidthValue.value,
  }));

  // Project info & global state
  const [projectInfo, setProjectInfo] = useState({ scripts: {}, frameworks: [] });
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [allFlatFiles, setAllFlatFiles] = useState([]);

  // Live agent session tracking (for the Stop button)
  const runningAgentIdRef = useRef(null);

  // --- TAB 1: AGENT STATE ---
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentMessages, setAgentMessages] = useState([
    {
      id: 'init',
      role: 'agent',
      type: 'info',
      content: '🐍 Oroborous AI Engine ready. I can write code, debug errors, run tests, and manage git across this workspace.'
    }
  ]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [currentPlan, setCurrentPlan] = useState([]);
  const [expandedTools, setExpandedTools] = useState({});
  const [showTimeline, setShowTimeline] = useState(false);
  const agentScrollRef = useRef(null);

  // --- TAB 2: CODE EDITOR STATE ---
  const [fileTree, setFileTree] = useState([]);
  const [openFiles, setOpenFiles] = useState([]);
  const [activeFile, setActiveFile] = useState(null);
  const [activeFileContent, setActiveFileContent] = useState('');
  const [loadingFileContent, setLoadingFileContent] = useState(false);
  const [isSavingFile, setIsSavingFile] = useState(false);
  const [showFileTree, setShowFileTree] = useState(true);
  // Unsaved-edit protection: live drafts + per-file dirty flags
  const draftsRef = useRef({});
  const [dirtyMap, setDirtyMap] = useState({});

  // --- TAB 3: GIT SUITE STATE ---
  const [gitStatus, setGitStatus] = useState(null);
  const [gitBranches, setGitBranches] = useState([]);
  const [selectedGitFile, setSelectedGitFile] = useState(null);
  const [gitDiffText, setGitDiffText] = useState('');
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [gitExecuting, setGitExecuting] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  const [recentCommits, setRecentCommits] = useState([]);

  // --- TAB 4: TERMINAL STATE ---
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([
    { id: 'init', type: 'info', text: `Oroborous Hyper-Terminal initialized.\nWorkspace: ${workspacePath || 'local'}\nType a shell command or tap shortcuts below.` }
  ]);
  const [commandHistoryMemory, setCommandHistoryMemory] = useState([]);
  const [historyPointer, setHistoryPointer] = useState(-1);
  const [runningCmd, setRunningCmd] = useState(false);
  const terminalScrollRef = useRef(null);
  // Race-free autoscroll: track whether the user is near the bottom of each
  // stream; only follow new content when they haven't scrolled up to read
  const agentNearBottomRef = useRef(true);
  const termNearBottomRef = useRef(true);

  const makeScrollTracker = (nearBottomRef, scrollRef) => ({
    onScroll: (e) => {
      const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
      const distanceFromBottom = contentSize.height - layoutMeasurement.height - contentOffset.y;
      nearBottomRef.current = distanceFromBottom < 80;
    },
    onContentSizeChange: () => {
      if (nearBottomRef.current) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollToEnd({ animated: true });
        });
      }
    },
    scrollEventThrottle: 100,
    maintainVisibleContentPosition: { minIndexForVisible: 0 },
  });

  const agentAutoScrollProps = makeScrollTracker(agentNearBottomRef, agentScrollRef);
  const termAutoScrollProps = makeScrollTracker(termNearBottomRef, terminalScrollRef);

  // Initial Data Fetch
  useEffect(() => {
    fetchWorkspaceData();
  }, [workspacePath]);

  const fetchWorkspaceData = async () => {
    try {
      const [proj, treeRes, gitRes, branchesRes, flatFilesRes, logRes] = await Promise.allSettled([
        api.getProjectInfo(),
        api.getFileTree(),
        api.getGitStatus(),
        api.getGitBranches(),
        api.listFiles(),
        api.getGitLog(10)
      ]);

      if (proj.status === 'fulfilled') setProjectInfo(proj.value);
      if (treeRes.status === 'fulfilled' && treeRes.value?.tree) setFileTree(treeRes.value.tree);
      if (gitRes.status === 'fulfilled') setGitStatus(gitRes.value);
      if (branchesRes.status === 'fulfilled') setGitBranches(branchesRes.value.branches || []);
      if (flatFilesRes.status === 'fulfilled') setAllFlatFiles(flatFilesRes.value.files || []);
      if (logRes.status === 'fulfilled') setRecentCommits(logRes.value.commits || []);

      // Auto-open README.md or package.json if no file open
      if (flatFilesRes.status === 'fulfilled' && flatFilesRes.value.files?.length > 0 && !activeFile) {
        const candidate = flatFilesRes.value.files.find(f => f.toLowerCase().includes('readme') || f === 'package.json') || flatFilesRes.value.files[0];
        handleOpenFile(candidate);
      }
    } catch (e) {
      console.warn('Error fetching workspace data:', e);
    }
  };

  // --- FILE EDITOR HANDLERS ---
  const confirmDiscardIfDirty = (filePath) => {
    return new Promise((resolve) => {
      if (!dirtyMap[filePath]) {
        resolve(true);
        return;
      }
      Alert.alert(
        'Unsaved Changes',
        `${filePath} has unsaved edits. What do you want to do?`,
        [
          { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Discard', style: 'destructive', onPress: () => { delete draftsRef.current[filePath]; resolve(true); } },
          { text: 'Keep Draft', onPress: () => resolve(true) }
        ]
      );
    });
  };

  const handleOpenFile = async (filePath) => {
    if (!filePath) return;
    if (filePath === activeFile && activeFileContent !== '') return;

    // Guard: switching away from a dirty active file
    if (activeFile && dirtyMap[activeFile] && filePath !== activeFile) {
      const ok = await confirmDiscardIfDirty(activeFile);
      if (!ok) return; // user chose Cancel — stay on current file
    }

    if (!openFiles.includes(filePath)) {
      setOpenFiles(prev => [...prev, filePath]);
    }
    setActiveFile(filePath);

    // Restore draft if one exists for this file
    const draft = draftsRef.current[filePath];
    if (draft !== undefined) {
      setActiveFileContent(draft);
      setDirtyMap(prev => ({ ...prev, [filePath]: true }));
      setLoadingFileContent(false);
      return;
    }

    setLoadingFileContent(true);
    try {
      const res = await api.readFile(filePath);
      setActiveFileContent(res.content || '');
      setDirtyMap(prev => ({ ...prev, [filePath]: false }));
    } catch (e) {
      setActiveFileContent(`// Error loading file: ${e.message}`);
    } finally {
      setLoadingFileContent(false);
    }
  };

  const handleCloseFileTab = async (filePathToClose) => {
    if (dirtyMap[filePathToClose]) {
      const ok = await confirmDiscardIfDirty(filePathToClose);
      if (!ok) return;
    }
    delete draftsRef.current[filePathToClose];
    const remaining = openFiles.filter(f => f !== filePathToClose);
    setOpenFiles(remaining);
    setDirtyMap(prev => {
      const next = { ...prev };
      delete next[filePathToClose];
      return next;
    });
    if (activeFile === filePathToClose) {
      if (remaining.length > 0) {
        handleOpenFile(remaining[remaining.length - 1]);
      } else {
        setActiveFile(null);
        setActiveFileContent('');
      }
    }
  };

  const handleEditorContentChange = (filePath, content) => {
    draftsRef.current[filePath] = content;
  };

  const handleDirtyChange = (filePath, isDirty) => {
    setDirtyMap(prev => ({ ...prev, [filePath]: isDirty }));
    if (!isDirty) delete draftsRef.current[filePath];
  };

  const handleSaveFileContent = async (filePath, content) => {
    setIsSavingFile(true);
    try {
      await api.writeFile(filePath, content);
      delete draftsRef.current[filePath];
      setDirtyMap(prev => ({ ...prev, [filePath]: false }));
      setActiveFileContent(content);
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      fetchWorkspaceData();
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Error', `Failed to save ${filePath}: ${e.message}`);
    } finally {
      setIsSavingFile(false);
    }
  };

  const handleCreateFile = async (newFilePath) => {
    try {
      await api.writeFile(newFilePath, '');
      await fetchWorkspaceData();
      handleOpenFile(newFilePath);
    } catch (e) {
      Alert.alert('Error', `Failed to create file: ${e.message}`);
    }
  };

  const handleCreateDir = async (dirPath) => {
    try {
      await api.createDir(dirPath);
      fetchWorkspaceData();
    } catch (e) {
      Alert.alert('Error', `Failed to create folder: ${e.message}`);
    }
  };

  const handleDeleteFile = async (filePath) => {
    try {
      await api.deleteFile(filePath);
      handleCloseFileTab(filePath);
      fetchWorkspaceData();
    } catch (e) {
      Alert.alert('Error', `Failed to delete: ${e.message}`);
    }
  };

  const handleRenameFile = async (oldPath, newPath) => {
    try {
      await api.renameFile(oldPath, newPath);
      handleCloseFileTab(oldPath);
      await fetchWorkspaceData();
      handleOpenFile(newPath);
    } catch (e) {
      Alert.alert('Error', `Failed to rename: ${e.message}`);
    }
  };

  // --- GIT HANDLERS ---
  const handleSelectGitFile = async (file) => {
    setSelectedGitFile(file);
    setLoadingDiff(true);
    try {
      const res = await api.getGitDiff(file);
      setGitDiffText(res.diff);
    } catch (e) {
      setGitDiffText(`Error loading diff: ${e.message}`);
    } finally {
      setLoadingDiff(false);
    }
  };

  const handleStageFile = async (file) => {
    try {
      await api.stageGit(file ? [file] : []);
      fetchWorkspaceData();
      if (selectedGitFile) handleSelectGitFile(selectedGitFile);
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Error', e.message);
    }
  };

  const handleUnstageFile = async (file) => {
    try {
      await api.unstageGit(file ? [file] : []);
      fetchWorkspaceData();
      if (selectedGitFile) handleSelectGitFile(selectedGitFile);
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Error', e.message);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) {
      Alert.alert('Error', 'Please enter a commit message');
      return;
    }
    setGitExecuting(true);
    try {
      const res = await api.commitGit(commitMsg.trim());
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Success', `Committed: ${res.commitHash || 'done'}`);
      setCommitMsg('');
      fetchWorkspaceData();
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Commit Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handlePush = async () => {
    setGitExecuting(true);
    try {
      await api.pushGit();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Success', 'Pushed changes to remote repository.');
      fetchWorkspaceData();
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Push Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handlePull = async () => {
    setGitExecuting(true);
    try {
      await api.pullGit();
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Success', 'Pulled latest changes from remote.');
      fetchWorkspaceData();
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Pull Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handleCheckoutBranch = async (branch, create = false) => {
    try {
      await api.checkoutBranch(branch, create);
      setShowBranchModal(false);
      setNewBranchName('');
      fetchWorkspaceData();
    } catch (e) {
      Alert.alert('Checkout Error', e.message);
    }
  };

  // --- TERMINAL HANDLERS ---
  const handleRunTerminalCommand = async (cmdText) => {
    const cmd = cmdText || terminalInput;
    if (!cmd.trim()) return;

    setRunningCmd(true);
    const cmdId = 'cmd-' + Date.now();
    setTerminalHistory(prev => [...prev, { id: cmdId, type: 'cmd', text: `$ ${cmd}` }]);
    setCommandHistoryMemory(prev => [cmd, ...prev.filter(c => c !== cmd)]);
    setHistoryPointer(-1);

    if (!cmdText) setTerminalInput('');

    try {
      const res = await api.runTerminalCommand(cmd);
      const output = res.stdout || res.stderr || '(command exited with no output)';
      setTerminalHistory(prev => [
        ...prev,
        {
          id: 'res-' + Date.now(),
          type: res.code === 0 ? 'output' : 'error',
          text: output,
          code: res.code,
          elapsed: res.elapsed
        }
      ]);

      if (cmd.includes('git ') || cmd.includes('npm ') || cmd.includes('yarn ') || cmd.includes('touch ') || cmd.includes('rm ')) {
        fetchWorkspaceData();
      }
    } catch (e) {
      setTerminalHistory(prev => [
        ...prev,
        { id: 'err-' + Date.now(), type: 'error', text: `Failed: ${e.message}` }
      ]);
    } finally {
      setRunningCmd(false);
    }
  };

  const handleTerminalSpecialKey = (action) => {
    if (action === 'cancel') {
      if (!runningCmd) {
        setTerminalHistory(prev => [...prev, { id: 'note-' + Date.now(), type: 'info', text: '(No running process to cancel — commands execute synchronously)' }]);
      }
    } else if (action === 'clear') {
      setTerminalHistory([]);
    } else if (action === 'historyUp') {
      if (commandHistoryMemory.length > 0) {
        const nextPtr = Math.min(commandHistoryMemory.length - 1, historyPointer + 1);
        setHistoryPointer(nextPtr);
        setTerminalInput(commandHistoryMemory[nextPtr]);
      }
    } else if (action === 'historyDown') {
      if (historyPointer > 0) {
        const nextPtr = historyPointer - 1;
        setHistoryPointer(nextPtr);
        setTerminalInput(commandHistoryMemory[nextPtr]);
      } else {
        setHistoryPointer(-1);
        setTerminalInput('');
      }
    }
  };

  // --- AGENT STUDIO HANDLERS ---
  const handleSendAgentTask = async (customPrompt) => {
    const promptToSend = customPrompt || agentPrompt;
    if (!promptToSend.trim() || agentRunning) return;

    setAgentPrompt('');
    setAgentRunning(true);

    const userMsgId = 'user-' + Date.now();
    let commitHash = null;

    // Auto-create checkpoint
    try {
      const statusRes = await api.getGitStatus();
      if (statusRes.isGit && statusRes.totalChanges > 0) {
        await api.stageGit([]);
        const commitRes = await api.commitGit(`[Checkpoint] Before: ${promptToSend.substring(0, 30)}`);
        commitHash = commitRes.commitHash || null;
      }
    } catch (_) {}

    setAgentMessages(prev => [
      ...prev,
      { id: userMsgId, role: 'user', type: 'text', content: promptToSend, commitHash }
    ]);

    let agentType = 'primary';
    let cleanPrompt = promptToSend;
    if (promptToSend.startsWith('/mini ')) {
      agentType = 'mini';
      cleanPrompt = promptToSend.substring(6);
    } else if (promptToSend.startsWith('/sub ')) {
      agentType = 'sub';
      cleanPrompt = promptToSend.substring(5);
    }

    try {
      await runAgentTask(cleanPrompt, (event) => {
        // Track session id so Stop can cancel this exact agent
        if (event.agentId) {
          runningAgentIdRef.current = event.agentId;
        }
        if (event.type === 'warning') {
          setAgentMessages(prev => [...prev, {
            id: 'warn-' + Date.now(), role: 'agent', type: 'info', content: event.text
          }]);
          return;
        }

        setAgentMessages(prev => {
          const newId = 'step-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
          if (event.type === 'info') {
            return [...prev, { id: newId, role: 'agent', type: 'info', content: event.text }];
          } else if (event.type === 'thought') {
            return [...prev, { id: newId, role: 'agent', type: 'thought', content: event.text }];
          } else if (event.type === 'tool_start') {
            return [...prev, { id: newId, role: 'agent', type: 'tool_start', content: `Tool: ${event.tool}`, details: event.details }];
          } else if (event.type === 'tool_end') {
            return [...prev, { id: newId, role: 'agent', type: 'tool_end', content: `Output: ${event.tool}`, details: event.result, isError: event.isError }];
          } else if (event.type === 'final_answer') {
            return [...prev, { id: newId, role: 'agent', type: 'final', content: event.text }];
          } else if (event.type === 'error') {
            return [...prev, { id: newId, role: 'agent', type: 'error', content: event.text }];
          }
          return prev;
        });

        // Plan updates live OUTSIDE the messages updater (no side effects in reducers)
        if (event.type === 'plan_update') {
          setCurrentPlan(event.todos || []);
        }
      }, agentType);
    } catch (err) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      setAgentMessages(prev => [
        ...prev,
        { id: 'err-' + Date.now(), role: 'agent', type: 'error', content: `Agent error: ${err.message}` }
      ]);
    } finally {
      runningAgentIdRef.current = null;
      setAgentRunning(false);
      fetchWorkspaceData();
    }
  };

  const handleStopAgent = () => {
    // Prefer cancelling this exact session; fall back to stopping everything
    if (!stopAgent(runningAgentIdRef.current)) {
      stopAllAgents();
    }
  };

  const handleRewind = async (msgId, commitHash) => {
    if (agentRunning) {
      Alert.alert('Error', 'Please stop the agent before rewinding.');
      return;
    }

    if (commitHash) {
      Alert.alert(
        'Time-Travel Rewind',
        `Rewind to checkpoint commit ${commitHash.substring(0, 7)}?`,
        [
          { text: 'Chat Only', onPress: () => performChatRewind(msgId) },
          {
            text: 'Reset Code & Chat',
            style: 'destructive',
            onPress: async () => {
              // Heavy haptic reserved for destructive/irreversible actions
              if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              try {
                await api.runTerminalCommand(`git reset --hard ${commitHash}`);
                performChatRewind(msgId);
                fetchWorkspaceData();
                Alert.alert('Success', `Workspace rewound to ${commitHash.substring(0, 7)}`);
              } catch (e) {
                Alert.alert('Error', e.message);
              }
            }
          },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } else {
      performChatRewind(msgId);
    }
  };

  const performChatRewind = (msgId) => {
    setAgentMessages(prev => {
      const idx = prev.findIndex(m => m.id === msgId);
      if (idx === -1) return prev;
      const userMsg = prev[idx];
      if (userMsg?.content) setAgentPrompt(userMsg.content);
      return prev.slice(0, idx);
    });
  };

  const handleQuickDeckAction = (actionKey, payload) => {
    if (actionKey === 'ai-prompt') {
      setActiveTab('agent');
      handleSendAgentTask(payload);
    } else if (actionKey === 'terminal-cmd') {
      setActiveTab('terminal');
      handleRunTerminalCommand(payload);
    } else if (actionKey === 'git-sync') {
      setActiveTab('git');
      handleStageFile();
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Sticky Workspace Top Header */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderLeft}>
          <TouchableOpacity
            style={styles.branchPill}
            onPress={() => setShowBranchModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="git-branch" size={13} color={THEMES.cyberpunk.primary} />
            <Text style={styles.branchPillText}>{gitStatus?.branch || 'main'}</Text>
            <Ionicons name="chevron-down" size={10} color={THEMES.cyberpunk.primary} />
          </TouchableOpacity>

          {gitStatus?.ahead > 0 && (
            <View style={styles.aheadBadge}>
              <Ionicons name="arrow-up" size={10} color="#4ade80" />
              <Text style={styles.aheadBadgeText}>{gitStatus.ahead}</Text>
            </View>
          )}

          {gitStatus?.behind > 0 && (
            <View style={styles.behindBadge}>
              <Ionicons name="arrow-down" size={10} color="#f87171" />
              <Text style={styles.behindBadgeText}>{gitStatus.behind}</Text>
            </View>
          )}
        </View>

        <View style={styles.topHeaderRight}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setShowCommandPalette(true)}
          >
            <Ionicons name="search" size={16} color={THEMES.cyberpunk.primary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={fetchWorkspaceData}
          >
            <Ionicons name="refresh" size={16} color={THEMES.cyberpunk.textMuted} />
          </TouchableOpacity>
        </View>
      </View>

      {/* 4 Power Tabs Header */}
      <View
        style={styles.tabContainer}
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
      >
        {tabWidth > 0 && (
          <Animated.View style={[styles.activeIndicatorLine, animatedIndicatorStyle]} />
        )}
        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('agent');
          }}
          accessibilityLabel="tab-agent"
        >
          <Ionicons name="sparkles" size={16} color={activeTab === 'agent' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'agent' && styles.activeTabText]}>Agent</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('editor');
          }}
          accessibilityLabel="tab-editor"
        >
          <Ionicons name="code-slash" size={16} color={activeTab === 'editor' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'editor' && styles.activeTabText]}>Editor</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('git');
          }}
          accessibilityLabel="tab-git"
        >
          <Ionicons name="git-compare" size={16} color={activeTab === 'git' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'git' && styles.activeTabText]}>Git</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tab}
          onPress={() => {
            if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setActiveTab('terminal');
          }}
          accessibilityLabel="tab-terminal"
        >
          <Ionicons name="terminal" size={16} color={activeTab === 'terminal' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'terminal' && styles.activeTabText]}>Terminal</Text>
        </TouchableOpacity>
      </View>

      {/* ========================================================================= */}
      {/* TAB 1: AGENT STUDIO                                                       */}
      {/* ========================================================================= */}
      {activeTab === 'agent' && (
        <View style={styles.tabViewWrapper}>
          {/* Live Task Goal Plan HUD */}
          {currentPlan.length > 0 && <GoalTracker todos={currentPlan} />}

          {/* Chat Messages */}
          <ScrollView
            ref={agentScrollRef}
            style={styles.agentScroll}
            contentContainerStyle={styles.agentContentContainer}
            showsVerticalScrollIndicator={true}
            {...agentAutoScrollProps}
          >
            {agentMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const isInfo = msg.type === 'info';
              const isThought = msg.type === 'thought';
              const isToolStart = msg.type === 'tool_start';
              const isToolEnd = msg.type === 'tool_end';
              const isError = msg.type === 'error';
              const isFinal = msg.type === 'final';

              if (isInfo) {
                return (
                  <View key={msg.id} style={styles.agentInfoBanner}>
                    <Ionicons name="information-circle" size={14} color="#38bdf8" />
                    <Text style={styles.agentInfoBannerText}>{msg.content}</Text>
                  </View>
                );
              }

              if (isError) {
                return (
                  <View key={msg.id} style={styles.agentErrorBanner}>
                    <Ionicons name="alert-circle" size={16} color="#f87171" />
                    <Text style={styles.agentErrorBannerText}>{msg.content}</Text>
                  </View>
                );
              }

              if (isToolStart) {
                return (
                  <View key={msg.id} style={styles.toolStartCard}>
                    <Ionicons name="cog-outline" size={14} color="#c084fc" />
                    <Text style={styles.toolStartCardText}>{msg.content}</Text>
                  </View>
                );
              }

              if (isToolEnd) {
                const isExpanded = !!expandedTools[msg.id];
                return (
                  <View key={msg.id} style={styles.toolResultContainer}>
                    <TouchableOpacity
                      style={styles.toolResultHeader}
                      onPress={() => setExpandedTools(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                      activeOpacity={0.8}
                    >
                      <Ionicons name={msg.isError ? "alert-circle" : "checkmark-circle"} size={14} color={msg.isError ? "#f87171" : "#4ade80"} />
                      <Text style={styles.toolResultTitle}>{msg.content}</Text>
                      <Text style={styles.toolExpandPrompt}>{isExpanded ? 'collapse' : 'view output'}</Text>
                    </TouchableOpacity>
                    {isExpanded && (
                      <ScrollView style={styles.toolResultBody} horizontal showsHorizontalScrollIndicator={true}>
                        <Text style={styles.toolResultBodyText}>{msg.details}</Text>
                      </ScrollView>
                    )}
                  </View>
                );
              }

              return (
                <FadeIn key={msg.id} delay={30} style={isUser ? styles.userRow : styles.agentRow}>
                  <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
                    <View style={styles.bubbleHeaderRow}>
                      {!isUser ? (
                        <View style={styles.aiBadge}>
                          <Ionicons name="sparkles" size={12} color="#00e1ff" />
                          <Text style={styles.aiBadgeText}>Oroborous</Text>
                        </View>
                      ) : (
                        <Text style={styles.userBadgeText}>You</Text>
                      )}

                      {isUser && msg.commitHash && (
                        <TouchableOpacity
                          style={styles.checkpointTag}
                          onPress={() => handleRewind(msg.id, msg.commitHash)}
                        >
                          <Ionicons name="time" size={11} color="#c084fc" />
                          <Text style={styles.checkpointTagText}>#{msg.commitHash.substring(0, 6)}</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    <Text style={[styles.bubbleText, isUser && styles.userBubbleText]}>
                      {msg.content}
                    </Text>
                  </View>
                </FadeIn>
              );
            })}

            {agentRunning && (
              <View style={styles.runningBadgeRow}>
                <ActivityIndicator size="small" color="#00e1ff" />
                <Text style={styles.runningBadgeText}>Agent reasoning & executing tools...</Text>
                <TouchableOpacity
                  style={styles.stopAgentBtn}
                  onPress={handleStopAgent}
                  accessibilityRole="button"
                  accessibilityLabel="Stop the running agent"
                >
                  <Text style={styles.stopAgentBtnText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>

          {/* Quick Prompts Carousel */}
          <View style={styles.quickPromptsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickPromptsScroll}>
              {[
                { label: 'Fix Bugs', prompt: '/fix Analyze and fix bugs in this workspace' },
                { label: 'Run Tests', prompt: '/test Write and execute tests to verify code' },
                { label: 'Explain Code', prompt: 'Explain the architecture of this codebase' },
                { label: 'Refactor', prompt: 'Refactor code to improve readability and performance' },
                { label: 'Git Commit', prompt: 'Analyze git diff and generate an idiomatic commit' },
                { label: 'Mini Fix', prompt: '/mini Quick fix formatting and syntax' }
              ].map((qp, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickPromptChip}
                  onPress={() => handleSendAgentTask(qp.prompt)}
                  disabled={agentRunning}
                >
                  <Text style={styles.quickPromptText}>{qp.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Agent Input Bar */}
          <GlassContainer style={styles.agentInputContainer} intensity={50}>
            <TextInput
              style={styles.agentInput}
              placeholder="Ask agent or type /goal, /mini, /sub..."
              placeholderTextColor="#94a3b8"
              value={agentPrompt}
              onChangeText={setAgentPrompt}
              onSubmitEditing={() => handleSendAgentTask()}
              autoCapitalize="none"
              editable={!agentRunning}
            />
            <BouncyButton
              style={styles.agentSendBtn}
              onPress={() => handleSendAgentTask()}
              disabled={agentRunning || !agentPrompt.trim()}
              hapticType="medium"
            >
              <Ionicons name="arrow-up" size={18} color="#050B14" />
            </BouncyButton>
          </GlassContainer>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: CODE EDITOR & EXPLORER                                             */}
      {/* ========================================================================= */}
      {activeTab === 'editor' && (
        <View style={styles.tabViewWrapper}>
          {/* Open File Tabs Header */}
          <View style={styles.openTabsBar}>
            <TouchableOpacity
              style={styles.toggleTreeBtn}
              onPress={() => setShowFileTree(prev => !prev)}
            >
              <Ionicons name={showFileTree ? "folder-open" : "folder"} size={16} color={THEMES.cyberpunk.primary} />
            </TouchableOpacity>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.openTabsScroll}>
              {openFiles.map((file) => {
                const isActive = activeFile === file;
                const isDirty = !!dirtyMap[file];
                const fileName = file.split('/').pop();
                return (
                  <TouchableOpacity
                    key={file}
                    style={[styles.fileTab, isActive && styles.fileTabActive]}
                    onPress={() => handleOpenFile(file)}
                    accessibilityRole="tab"
                    accessibilityLabel={`Open ${fileName}`}
                  >
                    <Text style={[styles.fileTabText, isActive && styles.fileTabTextActive]}>
                      {fileName}
                    </Text>
                    {isDirty ? (
                      <View style={styles.dirtyDot}>
                        <Text style={styles.dirtyDotText}>●</Text>
                      </View>
                    ) : null}
                    <TouchableOpacity
                      style={styles.fileTabClose}
                      onPress={() => handleCloseFileTab(file)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      accessibilityRole="button"
                      accessibilityLabel={`Close ${fileName}`}
                    >
                      <Ionicons name="close" size={12} color={isActive ? '#00e1ff' : '#64748b'} />
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Main Editor Split Area */}
          <View style={styles.editorSplitRow}>
            {showFileTree && (
              <View style={styles.treeSidebar}>
                <FileTree
                  tree={fileTree}
                  selectedPath={activeFile}
                  onSelectFile={handleOpenFile}
                  onCreateFile={handleCreateFile}
                  onCreateDir={handleCreateDir}
                  onDelete={handleDeleteFile}
                  onRename={handleRenameFile}
                />
              </View>
            )}

            <View style={styles.editorMainArea}>
              {activeFile ? (
                loadingFileContent ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#00e1ff" />
                    <Text style={styles.loadingSubtitle}>Reading file...</Text>
                  </View>
                ) : (
                  <CodeEditor
                    filePath={activeFile}
                    initialContent={draftsRef.current[activeFile] ?? activeFileContent}
                    onSave={handleSaveFileContent}
                    isSaving={isSavingFile}
                    onContentChange={handleEditorContentChange}
                    onDirtyChange={handleDirtyChange}
                  />
                )
              ) : (
                <View style={styles.centered}>
                  <Ionicons name="code-working-outline" size={48} color="rgba(0, 225, 255, 0.3)" />
                  <Text style={styles.noFileTitle}>No File Open</Text>
                  <Text style={styles.noFileSub}>Select a file from the explorer on the left to start editing</Text>
                </View>
              )}
            </View>
          </View>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: GIT SUITE                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'git' && (
        <View style={styles.tabViewWrapper}>
          <View style={styles.gitLayoutRow}>
            {/* Left Changes Explorer */}
            <View style={styles.gitChangesColumn}>
              <View style={styles.gitChangesHeader}>
                <Text style={styles.gitSectionTitle}>Modified Files ({gitStatus?.totalChanges || 0})</Text>
                <TouchableOpacity style={styles.stageAllBtn} onPress={() => handleStageFile()}>
                  <Text style={styles.stageAllBtnText}>Stage All</Text>
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.gitFileListScroll} showsVerticalScrollIndicator={true}>
                {gitStatus?.totalChanges === 0 ? (
                  <Text style={styles.cleanWorkingTreeText}>✓ Working tree is clean</Text>
                ) : (
                  <>
                    {(gitStatus?.stagedFiles || []).map((f, idx) => (
                      <TouchableOpacity
                        key={`staged-${idx}`}
                        style={[styles.gitFileItem, selectedGitFile === f.file && styles.gitFileItemActive]}
                        onPress={() => handleSelectGitFile(f.file)}
                      >
                        <Text style={[styles.gitBadge, { color: '#4ade80' }]}>{f.status}</Text>
                        <Text style={styles.gitFileName} numberOfLines={1}>{f.file}</Text>
                      </TouchableOpacity>
                    ))}

                    {(gitStatus?.unstagedFiles || []).map((f, idx) => (
                      <TouchableOpacity
                        key={`unstaged-${idx}`}
                        style={[styles.gitFileItem, selectedGitFile === f.file && styles.gitFileItemActive]}
                        onPress={() => handleSelectGitFile(f.file)}
                      >
                        <Text style={[styles.gitBadge, { color: '#38bdf8' }]}>{f.status}</Text>
                        <Text style={styles.gitFileName} numberOfLines={1}>{f.file}</Text>
                      </TouchableOpacity>
                    ))}

                    {(gitStatus?.untrackedFiles || []).map((f, idx) => (
                      <TouchableOpacity
                        key={`untracked-${idx}`}
                        style={[styles.gitFileItem, selectedGitFile === f.file && styles.gitFileItemActive]}
                        onPress={() => handleSelectGitFile(f.file)}
                      >
                        <Text style={[styles.gitBadge, { color: '#c084fc' }]}>?</Text>
                        <Text style={styles.gitFileName} numberOfLines={1}>{f.file}</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
              </ScrollView>
            </View>

            {/* Right Diff Viewer */}
            <View style={styles.gitDiffColumn}>
              {selectedGitFile ? (
                loadingDiff ? (
                  <View style={styles.centered}>
                    <ActivityIndicator size="small" color="#00e1ff" />
                    <Text style={styles.loadingSubtitle}>Generating Diff...</Text>
                  </View>
                ) : (
                  <DiffViewer
                    filePath={selectedGitFile}
                    diffText={gitDiffText}
                    onStageFile={handleStageFile}
                    onUnstageFile={handleUnstageFile}
                    isStaged={gitStatus?.stagedFiles?.some(s => s.file === selectedGitFile)}
                  />
                )
              ) : (
                <View style={styles.centered}>
                  <Ionicons name="git-compare-outline" size={40} color="rgba(0, 225, 255, 0.3)" />
                  <Text style={styles.noFileTitle}>Select a file to inspect diff</Text>
                </View>
              )}
            </View>
          </View>

          {/* Commit & Sync Actions Panel */}
          <GlassContainer style={styles.gitCommitPanel} intensity={40}>
            <TextInput
              style={styles.gitCommitInput}
              placeholder="Commit message..."
              placeholderTextColor="#94a3b8"
              value={commitMsg}
              onChangeText={setCommitMsg}
              editable={!gitExecuting}
            />
            <View style={styles.gitButtonsRow}>
              <BouncyButton
                style={[styles.gitBtn, { backgroundColor: '#00e1ff' }]}
                onPress={handleCommit}
                disabled={gitExecuting || !commitMsg.trim()}
                hapticType="medium"
              >
                <Ionicons name="git-commit-outline" size={15} color="#050B14" />
                <Text style={styles.gitBtnTextDark}>Commit</Text>
              </BouncyButton>

              <BouncyButton
                style={[styles.gitBtn, { backgroundColor: '#c084fc' }]}
                onPress={handlePush}
                disabled={gitExecuting}
                hapticType="medium"
              >
                <Ionicons name="cloud-upload-outline" size={15} color="#050B14" />
                <Text style={styles.gitBtnTextDark}>Push</Text>
              </BouncyButton>

              <BouncyButton
                style={[styles.gitBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                onPress={handlePull}
                disabled={gitExecuting}
                hapticType="light"
              >
                <Ionicons name="cloud-download-outline" size={15} color="#e2e8f0" />
                <Text style={styles.gitBtnText}>Pull</Text>
              </BouncyButton>
            </View>
          </GlassContainer>
        </View>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: HYPER-TERMINAL                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'terminal' && (
        <View style={styles.tabViewWrapper}>
          <ScrollView
            ref={terminalScrollRef}
            style={styles.termScroll}
            contentContainerStyle={styles.termContent}
            showsVerticalScrollIndicator={true}
            {...termAutoScrollProps}
          >
            {terminalHistory.map((item, idx) => (
              <View key={item.id || idx} style={styles.termLine}>
                <Text
                  style={[
                    styles.termText,
                    item.type === 'cmd' && styles.termTextCmd,
                    item.type === 'error' && styles.termTextError,
                    item.type === 'info' && styles.termTextInfo,
                  ]}
                >
                  {item.text}
                </Text>
              </View>
            ))}

            {runningCmd && (
              <View style={styles.runningRow}>
                <ActivityIndicator size="small" color="#00e1ff" />
                <Text style={styles.runningCmdText}>Executing process...</Text>
              </View>
            )}
          </ScrollView>

          {/* Quick Script Chips */}
          <View style={styles.termScriptsRow}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.termScriptsScroll}>
              {[
                { label: 'git status', cmd: 'git status -s' },
                { label: 'git diff', cmd: 'git diff' },
                { label: 'npm test', cmd: 'npm test' },
                { label: 'npm start', cmd: 'npm start' },
                { label: 'ls -la', cmd: 'ls -la' },
                { label: 'pwd', cmd: 'pwd' }
              ].map((s, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.termScriptChip}
                  onPress={() => handleRunTerminalCommand(s.cmd)}
                  disabled={runningCmd}
                >
                  <Text style={styles.termScriptText}>{s.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {/* Mobile Terminal Key Bar */}
          <TerminalKeyBar
            onKeyPress={(char) => setTerminalInput(prev => prev + char)}
            onSpecialAction={handleTerminalSpecialKey}
          />

          {/* Terminal Input Bar */}
          <GlassContainer style={styles.termInputContainer} intensity={40}>
            <Text style={styles.termPromptSymbol}>$</Text>
            <TextInput
              style={styles.termInput}
              placeholder="Execute shell command..."
              placeholderTextColor="#94a3b8"
              value={terminalInput}
              onChangeText={setTerminalInput}
              onSubmitEditing={() => handleRunTerminalCommand()}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!runningCmd}
            />
            <BouncyButton
              style={styles.termSendBtn}
              onPress={() => handleRunTerminalCommand()}
              disabled={runningCmd || !terminalInput.trim()}
              hapticType="medium"
            >
              <Ionicons name="play" size={16} color="#050B14" />
            </BouncyButton>
          </GlassContainer>
        </View>
      )}

      {/* Floating Action Deck */}
      <ActionDeck
        onQuickAction={handleQuickDeckAction}
        projectScripts={projectInfo.scripts}
      />

      {/* Command Palette (Cmd+K) Modal */}
      <CommandPalette
        visible={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
        files={allFlatFiles}
        onSelectFile={(f) => {
          setActiveTab('editor');
          handleOpenFile(f);
        }}
        onExecuteAction={(act) => {
          if (act.prompt) {
            setActiveTab('agent');
            handleSendAgentTask(act.prompt);
          } else if (act.cmd) {
            setActiveTab('terminal');
            handleRunTerminalCommand(act.cmd);
          }
        }}
      />

      {/* Git Branch Switcher Modal */}
      <Modal visible={showBranchModal} transparent animationType="fade" onRequestClose={() => setShowBranchModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Git Branches</Text>
              <TouchableOpacity onPress={() => setShowBranchModal(false)}>
                <Ionicons name="close" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            {/* Create new branch input */}
            <View style={styles.newBranchRow}>
              <TextInput
                style={styles.newBranchInput}
                placeholder="New branch name..."
                placeholderTextColor="#94a3b8"
                value={newBranchName}
                onChangeText={setNewBranchName}
                autoCapitalize="none"
              />
              <BouncyButton
                style={styles.newBranchBtn}
                onPress={() => handleCheckoutBranch(newBranchName.trim(), true)}
                disabled={!newBranchName.trim()}
              >
                <Text style={styles.newBranchBtnText}>Create</Text>
              </BouncyButton>
            </View>

            {/* Branches List */}
            <ScrollView style={styles.branchListScroll}>
              {gitBranches.map((b, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[styles.branchItemRow, b.current && styles.branchItemCurrent]}
                  onPress={() => handleCheckoutBranch(b.name, false)}
                >
                  <Ionicons name="git-branch" size={14} color={b.current ? '#00e1ff' : '#94a3b8'} />
                  <Text style={[styles.branchItemName, b.current && styles.branchItemNameCurrent]}>
                    {b.name}
                  </Text>
                  {b.current && <Text style={styles.currentBranchTag}>CURRENT</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#050B14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  topHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
  },
  branchPillText: {
    color: '#00e1ff',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  aheadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(74, 222, 128, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  aheadBadgeText: {
    color: '#4ade80',
    fontSize: 11,
    fontWeight: '700',
  },
  behindBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  behindBadgeText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  topHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: '#050B14',
  },
  activeIndicatorLine: {
    position: 'absolute',
    bottom: 0,
    height: 3,
    backgroundColor: '#00e1ff',
    borderRadius: 1.5,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    minHeight: 44,
    gap: 6,
  },
  tabText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#00e1ff',
  },
  tabViewWrapper: {
    flex: 1,
    backgroundColor: '#020617',
  },
  agentScroll: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 12,
  },
  agentContentContainer: {
    paddingBottom: 20,
  },
  agentInfoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  agentInfoBannerText: {
    color: '#38bdf8',
    fontSize: 12,
    flex: 1,
  },
  agentErrorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(248, 113, 113, 0.15)',
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginBottom: 8,
  },
  agentErrorBannerText: {
    color: '#f87171',
    fontSize: 12,
    flex: 1,
  },
  toolStartCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(192, 132, 252, 0.08)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    marginBottom: 6,
  },
  toolStartCardText: {
    color: '#c084fc',
    fontSize: 12,
    fontFamily: FONTS.mono,
  },
  toolResultContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  toolResultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 6,
  },
  toolResultTitle: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  toolExpandPrompt: {
    color: '#00e1ff',
    fontSize: 11,
  },
  toolResultBody: {
    padding: 8,
    backgroundColor: '#050B14',
    maxHeight: 150,
  },
  toolResultBodyText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  userRow: {
    alignItems: 'flex-end',
    marginBottom: 10,
  },
  agentRow: {
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  bubble: {
    maxWidth: '90%',
    borderRadius: 14,
    padding: 12,
  },
  userBubble: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
  },
  agentBubble: {
    backgroundColor: '#0B192C',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bubbleHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
    gap: 8,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  aiBadgeText: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '800',
  },
  userBadgeText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
  },
  checkpointTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  checkpointTagText: {
    color: '#c084fc',
    fontSize: 11,
    fontFamily: FONTS.mono,
    fontWeight: '700',
  },
  bubbleText: {
    color: '#e2e8f0',
    fontSize: 13,
    lineHeight: 19,
  },
  userBubbleText: {
    color: '#ffffff',
  },
  runningBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  runningBadgeText: {
    color: '#00e1ff',
    fontSize: 12,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  stopAgentBtn: {
    backgroundColor: 'rgba(248, 113, 113, 0.2)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    minHeight: 36,
    justifyContent: 'center',
  },
  stopAgentBtnText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '700',
  },
  quickPromptsRow: {
    paddingVertical: 6,
    backgroundColor: '#050B14',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  quickPromptsScroll: {
    paddingHorizontal: 12,
    gap: 6,
  },
  quickPromptChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  quickPromptText: {
    color: '#cbd5e1',
    fontSize: 11,
    fontWeight: '600',
  },
  agentInputContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
  },
  agentInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.mono,
    paddingHorizontal: 10,
    height: 38,
  },
  agentSendBtn: {
    backgroundColor: '#00e1ff',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  openTabsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#050B14',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  toggleTreeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.08)',
  },
  openTabsScroll: {
    paddingHorizontal: 4,
    gap: 4,
  },
  fileTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    gap: 6,
  },
  fileTabActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderBottomWidth: 2,
    borderBottomColor: '#00e1ff',
  },
  fileTabText: {
    color: '#64748b',
    fontSize: 12,
    fontFamily: FONTS.mono,
  },
  fileTabTextActive: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  fileTabClose: {
    padding: 6,
  },
  dirtyDot: {
    paddingHorizontal: 2,
  },
  dirtyDotText: {
    color: '#f59e0b',
    fontSize: 11,
  },
  editorSplitRow: {
    flex: 1,
    flexDirection: 'row',
  },
  treeSidebar: {
    width: 140,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
  },
  editorMainArea: {
    flex: 1,
    backgroundColor: '#020617',
  },
  gitLayoutRow: {
    flex: 1,
    flexDirection: 'row',
  },
  gitChangesColumn: {
    width: 140,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.06)',
    backgroundColor: '#050B14',
  },
  gitChangesHeader: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  gitSectionTitle: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  stageAllBtn: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    paddingVertical: 8,
    borderRadius: 4,
    alignItems: 'center',
    minHeight: 32,
  },
  stageAllBtnText: {
    color: '#00e1ff',
    fontSize: 12,
    fontWeight: '700',
  },
  gitFileListScroll: {
    flex: 1,
  },
  gitFileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  gitFileItemActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
  },
  gitBadge: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: FONTS.mono,
  },
  gitFileName: {
    color: '#cbd5e1',
    fontSize: 11,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  cleanWorkingTreeText: {
    color: '#4ade80',
    fontSize: 11,
    fontStyle: 'italic',
    padding: 10,
    textAlign: 'center',
  },
  gitDiffColumn: {
    flex: 1,
    backgroundColor: '#020617',
  },
  gitCommitPanel: {
    marginHorizontal: 12,
    marginBottom: 12,
    padding: 10,
    borderRadius: 14,
  },
  gitCommitInput: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    color: '#ffffff',
    fontSize: 12,
    fontFamily: FONTS.mono,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  gitButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  gitBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 8,
    gap: 4,
  },
  gitBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
  },
  gitBtnTextDark: {
    color: '#050B14',
    fontSize: 12,
    fontWeight: '800',
  },
  termScroll: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
  },
  termContent: {
    paddingBottom: 20,
  },
  termLine: {
    marginBottom: 4,
  },
  termText: {
    color: '#cbd5e1',
    fontSize: 12,
    lineHeight: 18,
    fontFamily: FONTS.mono,
  },
  termTextCmd: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  termTextError: {
    color: '#f87171',
  },
  termTextInfo: {
    color: '#c084fc',
    fontStyle: 'italic',
  },
  runningRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  runningCmdText: {
    color: '#00e1ff',
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  termScriptsRow: {
    backgroundColor: '#050B14',
    paddingVertical: 6,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
  },
  termScriptsScroll: {
    paddingHorizontal: 10,
    gap: 6,
  },
  termScriptChip: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  termScriptText: {
    color: '#94a3b8',
    fontSize: 11,
    fontFamily: FONTS.mono,
  },
  termInputContainer: {
    marginHorizontal: 12,
    marginBottom: 12,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
  },
  termPromptSymbol: {
    color: '#00e1ff',
    fontSize: 14,
    fontWeight: '800',
    fontFamily: FONTS.mono,
    marginRight: 6,
  },
  termInput: {
    flex: 1,
    color: '#ffffff',
    fontSize: 13,
    fontFamily: FONTS.mono,
    height: 36,
  },
  termSendBtn: {
    backgroundColor: '#00e1ff',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingSubtitle: {
    color: '#64748b',
    marginTop: 8,
    fontSize: 12,
  },
  noFileTitle: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 10,
  },
  noFileSub: {
    color: '#64748b',
    fontSize: 12,
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: '#0B192C',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.25)',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '800',
  },
  newBranchRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  newBranchInput: {
    flex: 1,
    backgroundColor: '#050B14',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: '#ffffff',
    fontSize: 12,
    fontFamily: FONTS.mono,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  newBranchBtn: {
    backgroundColor: '#00e1ff',
    paddingHorizontal: 12,
    borderRadius: 8,
    justifyContent: 'center',
  },
  newBranchBtnText: {
    color: '#050B14',
    fontSize: 12,
    fontWeight: '800',
  },
  branchListScroll: {
    maxHeight: 220,
  },
  branchItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderRadius: 6,
    gap: 6,
  },
  branchItemCurrent: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
  },
  branchItemName: {
    color: '#cbd5e1',
    fontSize: 12,
    fontFamily: FONTS.mono,
    flex: 1,
  },
  branchItemNameCurrent: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  currentBranchTag: {
    color: '#00e1ff',
    fontSize: 11,
    fontWeight: '800',
    backgroundColor: 'rgba(0, 225, 255, 0.15)',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

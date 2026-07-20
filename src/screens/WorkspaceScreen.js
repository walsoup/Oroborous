import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, ActivityIndicator, Alert, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import { LinearGradient } from 'expo-linear-gradient';
import { api } from '../services/api';
import { runAgentTask, getActiveAgents } from '../services/agent';

export default function WorkspaceScreen({ route, navigation }) {
  const workspace = route.params?.workspace;
  const repoName = workspace?.name || 'Workspace';
  const workspacePath = workspace?.path;

  const [activeTab, setActiveTab] = useState('git'); // 'git', 'terminal', or 'agent'
  const [gitStatus, setGitStatus] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileDiff, setFileDiff] = useState('');
  const [loadingGit, setLoadingGit] = useState(false);
  const [loadingDiff, setLoadingDiff] = useState(false);
  const [commitMsg, setCommitMsg] = useState('');
  const [gitExecuting, setGitExecuting] = useState(false);
  const [explorerMode, setExplorerMode] = useState('git'); // 'git' or 'files'
  const [allFiles, setAllFiles] = useState([]);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [viewingMode, setViewingMode] = useState('diff'); // 'diff' or 'content'
  const [fileContent, setFileContent] = useState('');
  const [loadingContent, setLoadingContent] = useState(false);

  // Terminal state
  const [terminalInput, setTerminalInput] = useState('');
  const [terminalHistory, setTerminalHistory] = useState([
    { id: 'init', type: 'info', text: `Oroborous Terminal Interpreter initialized.\nWorkspace: ${workspacePath || 'none'}\nReady for commands.` }
  ]);
  const [runningCmd, setRunningCmd] = useState(false);
  const terminalScrollRef = useRef(null);

  // Agent state
  const [agentPrompt, setAgentPrompt] = useState('');
  const [agentMessages, setAgentMessages] = useState([
    { id: 'init', role: 'agent', type: 'info', content: 'Oroborous AI Agent ready. Ask me to write code, solve bugs, run tests, or manage git.' }
  ]);
  const [agentRunning, setAgentRunning] = useState(false);
  const [expandedTools, setExpandedTools] = useState({}); // maps messageId -> boolean
  const [autoCompact, setAutoCompact] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const agentScrollRef = useRef(null);

  useEffect(() => {
    fetchGitStatus();
  }, [workspacePath]);

  const fetchGitStatus = async () => {
    if (!workspacePath) return;
    setLoadingGit(true);
    try {
      const res = await api.getGitStatus();
      setGitStatus(res);
      
      // Auto-select first modified file if available and none selected
      if (res.statusShort) {
        const lines = res.statusShort.trim().split('\n');
        if (lines.length > 0) {
          const firstFile = lines[0].substring(3).trim();
          setSelectedFile(firstFile);
          fetchFileDiff(firstFile);
        }
      } else {
        setSelectedFile(null);
        setFileDiff('');
      }
    } catch (e) {
      console.error(e);
      setGitStatus(null);
    } finally {
      setLoadingGit(false);
    }
  };

  const fetchFileDiff = async (file) => {
    setLoadingDiff(true);
    try {
      const res = await api.getGitDiff(file);
      setFileDiff(res.diff);
    } catch (e) {
      setFileDiff('Error loading diff: ' + e.message);
    } finally {
      setLoadingDiff(false);
    }
  };

  useEffect(() => {
    if (explorerMode === 'files') {
      fetchAllFiles();
    }
  }, [explorerMode, workspacePath]);

  const fetchAllFiles = async () => {
    if (!workspacePath) return;
    setLoadingFiles(true);
    try {
      const res = await api.listFiles();
      setAllFiles(res.files || []);
    } catch (e) {
      console.warn('Failed to load files:', e);
    } finally {
      setLoadingFiles(false);
    }
  };

  const fetchFileContent = async (file) => {
    setLoadingContent(true);
    try {
      const res = await api.readFile(file);
      setFileContent(res.content || '');
    } catch (e) {
      setFileContent('Error loading file content: ' + e.message);
    } finally {
      setLoadingContent(false);
    }
  };

  const handleSelectFile = async (file, forceMode = null) => {
    setSelectedFile(file);
    const isModified = modifiedFiles.some(f => f.filepath === file);
    const mode = forceMode || (isModified ? 'diff' : 'content');
    setViewingMode(mode);

    if (mode === 'diff') {
      fetchFileDiff(file);
    } else {
      fetchFileContent(file);
    }
  };

  const handleStageAll = async () => {
    setGitExecuting(true);
    try {
      const res = await api.runTerminalCommand('git add -A');
      if (res.code === 0) {
        Alert.alert('Success', 'All changes staged.');
        fetchGitStatus();
      } else {
        Alert.alert('Error', `Failed to stage changes: ${res.stderr}`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handleCommit = async () => {
    if (!commitMsg.trim()) {
      Alert.alert('Error', 'Please enter a commit message.');
      return;
    }
    setGitExecuting(true);
    try {
      const statusRes = await api.runTerminalCommand('git diff --cached --quiet');
      if (statusRes.code === 0) {
        Alert.alert(
          'Stage changes?',
          'No changes are currently staged. Stage all files and commit?',
          [
            { text: 'Cancel', style: 'cancel', onPress: () => setGitExecuting(false) },
            {
              text: 'Stage & Commit',
              onPress: async () => {
                const addRes = await api.runTerminalCommand('git add -A');
                if (addRes.code === 0) {
                  await performCommit();
                } else {
                  Alert.alert('Error', `Failed to stage: ${addRes.stderr}`);
                  setGitExecuting(false);
                }
              }
            }
          ]
        );
      } else {
        await performCommit();
      }
    } catch (e) {
      Alert.alert('Error', e.message);
      setGitExecuting(false);
    }
  };

  const performCommit = async () => {
    try {
      const res = await api.runTerminalCommand(`git -c user.name="Oroborous" -c user.email="oroborous@agent.local" commit -m "${commitMsg.replace(/"/g, '\\"')}"`);
      if (res.code === 0) {
        Alert.alert('Success', 'Changes committed successfully.');
        setCommitMsg('');
        fetchGitStatus();
      } else {
        Alert.alert('Error', `Failed to commit: ${res.stderr || res.stdout}`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handlePush = async () => {
    setGitExecuting(true);
    try {
      const res = await api.runTerminalCommand('git push');
      if (res.code === 0) {
        Alert.alert('Success', 'Changes pushed successfully.');
        fetchGitStatus();
      } else {
        Alert.alert('Error', `Failed to push: ${res.stderr || res.stdout}`);
      }
    } catch (e) {
      Alert.alert('Error', e.message);
    } finally {
      setGitExecuting(false);
    }
  };

  const handleRunCommand = async (cmdText) => {
    const command = cmdText || terminalInput;
    if (!command.trim()) return;

    setRunningCmd(true);
    const userCmdItem = { id: Date.now().toString() + '-cmd', type: 'cmd', text: `$ ${command}` };
    setTerminalHistory(prev => [...prev, userCmdItem]);
    if (!cmdText) setTerminalInput('');

    // Scroll to bottom
    setTimeout(() => {
      terminalScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    try {
      const res = await api.runTerminalCommand(command);
      const outputText = res.stdout || res.stderr || '(command completed with no output)';
      const isError = res.code !== 0;

      setTerminalHistory(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-res',
          type: isError ? 'error' : 'output',
          text: outputText,
          code: res.code
        }
      ]);

      if (command.includes('git ') || command.includes('npm ') || command.includes('yarn ')) {
        fetchGitStatus();
        if (explorerMode === 'files') {
          fetchAllFiles();
        }
      }
    } catch (e) {
      setTerminalHistory(prev => [
        ...prev,
        {
          id: Date.now().toString() + '-err',
          type: 'error',
          text: `Failed to execute: ${e.message}`
        }
      ]);
    } finally {
      setRunningCmd(false);
      setTimeout(() => {
        terminalScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Agent submit handler
  const handleSendAgentTask = async () => {
    if (!agentPrompt.trim() || agentRunning) return;
    const prompt = agentPrompt;
    setAgentPrompt('');
    setAgentRunning(true);

    const userMsgId = Date.now().toString() + '-user';
    setAgentMessages(prev => [...prev, { id: userMsgId, role: 'user', type: 'text', content: prompt }]);

    setTimeout(() => {
      agentScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);

    if (prompt.trim() === '/agents') {
      const running = getActiveAgents();
      let content = '';
      if (running.length === 0) {
        content = 'No active agents or sub-agents are currently running.';
      } else {
        content = 'Active Running Agents:\n' + running.map(a => {
          const elapsed = Math.round((new Date() - a.startTime) / 1000);
          return `• [${a.type.toUpperCase()}] "${a.task}" (running for ${elapsed}s)`;
        }).join('\n');
      }
      
      setAgentMessages(prev => [...prev, {
        id: Date.now().toString() + '-status',
        role: 'agent',
        type: 'info',
        content
      }]);
      setAgentRunning(false);
      setTimeout(() => {
        agentScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return;
    }

    if (prompt.trim() === '/compact') {
      setAgentMessages(prev => {
        const compacted = compactConversation(prev);
        return [...compacted, {
          id: Date.now().toString() + '-compact',
          role: 'agent',
          type: 'info',
          content: 'Conversation compacted.'
        }];
      });
      setAgentRunning(false);
      setTimeout(() => {
        agentScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
      return;
    }

    let agentType = 'primary';
    let taskText = prompt;

    if (prompt.trim().startsWith('/mini ')) {
      agentType = 'mini';
      taskText = prompt.trim().substring(6);
    } else if (prompt.trim().startsWith('/sub ')) {
      agentType = 'sub';
      taskText = prompt.trim().substring(5);
    }

    let commitHash = null;
    try {
      const gitStatus = await api.getGitStatus();
      if (gitStatus && gitStatus.isGit) {
        await api.runTerminalCommand('git add -A');
        const diffRes = await api.runTerminalCommand('git diff --cached --quiet');
        if (diffRes.code !== 0) {
          const commitRes = await api.runTerminalCommand(
            `git -c user.name="Oroborous" -c user.email="oroborous@agent.local" commit -m "[Oroborous Checkpoint] Before: ${prompt.replace(/"/g, '\\"')}"`
          );
          if (commitRes.code === 0) {
            const hashRes = await api.runTerminalCommand('git rev-parse HEAD');
            if (hashRes.code === 0) {
              commitHash = hashRes.stdout.trim();
            }
          }
        } else {
          const hashRes = await api.runTerminalCommand('git rev-parse HEAD');
          if (hashRes.code === 0) {
            commitHash = hashRes.stdout.trim();
          }
        }
        
        if (commitHash) {
          setAgentMessages(prev => prev.map(m => m.id === userMsgId ? { ...m, commitHash } : m));
        }
      }
    } catch (e) {
      console.warn('Failed to create git checkpoint:', e);
    }

    try {
      await runAgentTask(taskText, (step) => {
        setAgentMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          const newId = Date.now().toString() + '-' + Math.random().toString(36).substr(2, 4);

          if (step.type === 'info') {
            return [...prev, { id: newId, role: 'agent', type: 'info', content: step.text }];
          } else if (step.type === 'thought') {
            const filtered = lastMsg?.type === 'info' && lastMsg.content.includes('Thinking') ? prev.slice(0, -1) : prev;
            return [...filtered, { id: newId, role: 'agent', type: 'thought', content: step.text }];
          } else if (step.type === 'tool_start') {
            return [...prev, { id: newId, role: 'agent', type: 'tool_start', content: `🔧 Using tool: ${step.tool}`, details: step.details }];
          } else if (step.type === 'tool_end') {
            return [...prev, { id: newId, role: 'agent', type: 'tool_end', content: `✅ Tool ${step.tool} output`, details: step.result }];
          } else if (step.type === 'final_answer') {
            const filtered = lastMsg?.type === 'info' ? prev.slice(0, -1) : prev;
            return [...filtered, { id: newId, role: 'agent', type: 'final', content: step.text }];
          } else if (step.type === 'error') {
            return [...prev, { id: newId, role: 'agent', type: 'error', content: step.text }];
          }
          return prev;
        });

        setTimeout(() => {
          agentScrollRef.current?.scrollToEnd({ animated: true });
        }, 100);
      }, agentType);
    } catch (err) {
      setAgentMessages(prev => [...prev, { id: Date.now().toString(), role: 'agent', type: 'error', content: err.message }]);
    } finally {
      setAgentRunning(false);
      fetchGitStatus(); // Refresh git status after agent finishes
      if (explorerMode === 'files') {
        fetchAllFiles();
      }
      if (autoCompact) {
        setAgentMessages(prev => compactConversation(prev));
      }
      setTimeout(() => {
        agentScrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  const compactConversation = (messagesArray) => {
    return messagesArray.filter(msg => {
      if (msg.id === 'init') return true;
      return msg.role === 'user' || msg.type === 'final' || msg.type === 'error';
    });
  };

  const handleManualCompact = () => {
    setAgentMessages(prev => {
      const compacted = compactConversation(prev);
      if (compacted.length === prev.length) {
        Alert.alert('Info', 'Conversation is already compacted.');
      } else {
        Alert.alert('Success', 'Conversation compacted successfully.');
      }
      return compacted;
    });
  };

  const handleRewind = (msgId, commitHash) => {
    if (agentRunning) {
      Alert.alert('Error', 'Cannot rewind while the agent is running.');
      return;
    }

    const performChatRewind = () => {
      setAgentMessages(prev => {
        const idx = prev.findIndex(m => m.id === msgId);
        if (idx === -1) return prev;
        const userMsg = prev[idx];
        if (userMsg && userMsg.role === 'user') {
          setAgentPrompt(userMsg.content);
        }
        return prev.slice(0, idx);
      });
    };

    if (commitHash) {
      Alert.alert(
        'Rewind Options',
        `This message has a Git checkpoint (${commitHash.substring(0, 7)}).\n\nChoose how you want to travel back in time:`,
        [
          {
            text: 'Rewind Chat Only',
            onPress: () => {
              performChatRewind();
            }
          },
          {
            text: 'Rewind Chat & Code',
            style: 'destructive',
            onPress: async () => {
              try {
                const res = await api.runTerminalCommand(`git reset --hard ${commitHash}`);
                if (res.code === 0) {
                  performChatRewind();
                  fetchGitStatus();
                  Alert.alert('Success', `Workspace rewound to commit ${commitHash.substring(0, 7)}.`);
                } else {
                  Alert.alert('Error', `Failed to reset git: ${res.stderr}`);
                }
              } catch (e) {
                Alert.alert('Error', `Failed to reset git: ${e.message}`);
              }
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    } else {
      Alert.alert(
        'Rewind Chat',
        'This will delete all messages after this point and put this prompt back in the input. Proceed?',
        [
          {
            text: 'Yes',
            onPress: () => {
              performChatRewind();
            }
          },
          {
            text: 'Cancel',
            style: 'cancel'
          }
        ]
      );
    }
  };

  const toggleToolExpand = (id) => {
    setExpandedTools(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const renderDiffLine = (line, idx) => {
    let lineStyle = styles.diffNormal;
    if (line.startsWith('+') && !line.startsWith('+++')) {
      lineStyle = styles.diffAddition;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      lineStyle = styles.diffDeletion;
    } else if (line.startsWith('@@')) {
      lineStyle = styles.diffMeta;
    }

    return (
      <Text key={idx} style={[styles.diffLine, lineStyle]}>
        {line}
      </Text>
    );
  };

  const parseModifiedFiles = (statusText) => {
    if (!statusText) return [];
    return statusText.trim().split('\n').map(line => {
      const status = line.substring(0, 2);
      const filepath = line.substring(3).trim();
      return { status, filepath };
    });
  };

  const modifiedFiles = parseModifiedFiles(gitStatus?.statusShort);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* Sticky Header */}
      <View style={styles.repoStickyHeader}>
        <View style={styles.headerInfo}>
          <Ionicons name="git-branch" size={16} color="#00e1ff" />
          <Text style={styles.repoStickyText}>
            {repoName} <Text style={{ color: '#64748b' }}>({gitStatus?.branch || 'main'})</Text>
          </Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={fetchGitStatus} disabled={loadingGit}>
          {loadingGit ? (
            <ActivityIndicator size="small" color="#00e1ff" />
          ) : (
            <Ionicons name="refresh" size={18} color="#e2e8f0" />
          )}
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'git' && styles.activeTab]}
          onPress={() => setActiveTab('git')}
        >
          <Ionicons name="git-compare-outline" size={20} color={activeTab === 'git' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'git' && styles.activeTabText]}>Git & Diffs</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'terminal' && styles.activeTab]}
          onPress={() => setActiveTab('terminal')}
        >
          <Ionicons name="terminal-outline" size={20} color={activeTab === 'terminal' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'terminal' && styles.activeTabText]}>Terminal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'agent' && styles.activeTab]}
          onPress={() => setActiveTab('agent')}
        >
          <Ionicons name="sparkles-outline" size={20} color={activeTab === 'agent' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'agent' && styles.activeTabText]}>AI Agent</Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {activeTab === 'git' ? (
        <View style={{ flex: 1 }}>
          <View style={styles.gitView}>
            <GlassContainer style={styles.explorer} intensity={30}>
              <View style={styles.explorerHeader}>
                <Text style={styles.explorerTitle}>
                  {explorerMode === 'git' ? 'Changes' : 'Files'}
                </Text>
                <View style={styles.explorerToggleRow}>
                  <TouchableOpacity 
                    style={[styles.explorerToggleBtn, explorerMode === 'git' && styles.explorerToggleBtnActive]} 
                    onPress={() => setExplorerMode('git')}
                  >
                    <Ionicons name="git-branch" size={12} color={explorerMode === 'git' ? '#00e1ff' : '#64748b'} />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.explorerToggleBtn, explorerMode === 'files' && styles.explorerToggleBtnActive]} 
                    onPress={() => setExplorerMode('files')}
                  >
                    <Ionicons name="folder-open" size={12} color={explorerMode === 'files' ? '#00e1ff' : '#64748b'} />
                  </TouchableOpacity>
                </View>
              </View>

              {explorerMode === 'git' ? (
                modifiedFiles.length === 0 ? (
                  <Text style={styles.cleanTreeText}>Working tree clean</Text>
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {modifiedFiles.map((file, idx) => {
                      const isSelected = selectedFile === file.filepath;
                      let statusColor = '#e2e8f0';
                      if (file.status.includes('M')) statusColor = '#38bdf8';
                      else if (file.status.includes('A') || file.status.includes('?')) statusColor = '#4ade80';
                      else if (file.status.includes('D')) statusColor = '#f87171';

                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[styles.fileItem, isSelected && styles.fileItemActive]}
                          onPress={() => handleSelectFile(file.filepath)}
                        >
                          <Text style={[styles.fileStatusBadge, { color: statusColor }]}>
                            {file.status.trim()}
                          </Text>
                          <Text
                            style={[styles.fileName, isSelected && styles.fileNameActive]}
                            numberOfLines={1}
                            ellipsizeMode="tail"
                          >
                            {file.filepath}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </ScrollView>
                )
              ) : (
                loadingFiles ? (
                  <ActivityIndicator size="small" color="#00e1ff" style={{ marginTop: 20 }} />
                ) : (
                  <ScrollView showsVerticalScrollIndicator={false}>
                    {allFiles.length === 0 ? (
                      <Text style={styles.cleanTreeText}>No files found</Text>
                    ) : (
                      allFiles.map((file, idx) => {
                        const isSelected = selectedFile === file;
                        const isFileModified = modifiedFiles.some(f => f.filepath === file);
                        
                        return (
                          <TouchableOpacity
                            key={idx}
                            style={[styles.fileItem, isSelected && styles.fileItemActive]}
                            onPress={() => handleSelectFile(file)}
                          >
                            <Ionicons 
                              name={isSelected ? "document" : "document-outline"} 
                              size={12} 
                              color={isFileModified ? "#38bdf8" : "#94a3b8"} 
                              style={{ marginRight: 2 }}
                            />
                            <Text
                              style={[
                                styles.fileName, 
                                isSelected && styles.fileNameActive,
                                isFileModified && { color: '#38bdf8' }
                              ]}
                              numberOfLines={1}
                              ellipsizeMode="tail"
                            >
                              {file}
                            </Text>
                          </TouchableOpacity>
                        );
                      })
                    )}
                  </ScrollView>
                )
              )}
            </GlassContainer>

            <View style={styles.diffContainer}>
              {selectedFile ? (
                <View style={{ flex: 1 }}>
                  <View style={styles.diffHeader}>
                    <Text style={styles.diffTitle} numberOfLines={1}>
                      {selectedFile}
                    </Text>
                    {modifiedFiles.some(f => f.filepath === selectedFile) && (
                      <View style={styles.viewModeToggleRow}>
                        <TouchableOpacity 
                          style={[styles.viewModeToggleBtn, viewingMode === 'diff' && styles.viewModeToggleBtnActive]} 
                          onPress={() => handleSelectFile(selectedFile, 'diff')}
                        >
                          <Text style={[styles.viewModeToggleText, viewingMode === 'diff' && { color: '#00e1ff' }]}>Diff</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                          style={[styles.viewModeToggleBtn, viewingMode === 'content' && styles.viewModeToggleBtnActive]} 
                          onPress={() => handleSelectFile(selectedFile, 'content')}
                        >
                          <Text style={[styles.viewModeToggleText, viewingMode === 'content' && { color: '#00e1ff' }]}>Code</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>

                  {viewingMode === 'diff' ? (
                    loadingDiff ? (
                      <View style={styles.centered}>
                        <ActivityIndicator size="large" color="#00e1ff" />
                        <Text style={styles.loadingText}>Generating Diff...</Text>
                      </View>
                    ) : (
                      <ScrollView style={styles.diffScroll} showsHorizontalScrollIndicator={true} showsVerticalScrollIndicator={true}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                          <View style={styles.diffContent}>
                            {fileDiff.split('\n').map((line, idx) => renderDiffLine(line, idx))}
                          </View>
                        </ScrollView>
                      </ScrollView>
                    )
                  ) : (
                    loadingContent ? (
                      <View style={styles.centered}>
                        <ActivityIndicator size="large" color="#00e1ff" />
                        <Text style={styles.loadingText}>Loading File Content...</Text>
                      </View>
                    ) : (
                      <ScrollView style={styles.diffScroll} showsHorizontalScrollIndicator={true} showsVerticalScrollIndicator={true}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
                          <View style={styles.editorContent}>
                            <View style={styles.lineNumbers}>
                              {fileContent.split('\n').map((_, i) => (
                                <Text key={i} style={styles.lineNumber}>{i + 1}</Text>
                              ))}
                            </View>
                            <View style={styles.codeArea}>
                              {fileContent.split('\n').map((line, i) => (
                                <Text key={i} style={styles.codeLine}>{line}</Text>
                              ))}
                            </View>
                          </View>
                        </ScrollView>
                      </ScrollView>
                    )
                  )}
                </View>
              ) : (
                <View style={styles.centered}>
                  <Ionicons name="document-text-outline" size={48} color="#1e293b" />
                  <Text style={styles.noFileSelectedText}>No file selected</Text>
                </View>
              )}
            </View>
          </View>

          {/* Git Commit & Push Actions Panel */}
          <GlassContainer style={styles.commitPanel} intensity={40}>
            <TextInput
              style={styles.commitInput}
              placeholder="Commit message..."
              placeholderTextColor="#64748b"
              value={commitMsg}
              onChangeText={setCommitMsg}
              disabled={gitExecuting}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.commitActionsRow}>
              <TouchableOpacity 
                style={[styles.gitActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]} 
                onPress={handleStageAll}
                disabled={gitExecuting}
              >
                <Ionicons name="add-circle-outline" size={16} color="#e2e8f0" />
                <Text style={styles.gitActionBtnText}>Stage All</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.gitActionBtn, { backgroundColor: '#00e1ff' }]} 
                onPress={handleCommit}
                disabled={gitExecuting || !commitMsg.trim()}
              >
                <Ionicons name="git-commit-outline" size={16} color="#050B14" />
                <Text style={[styles.gitActionBtnText, { color: '#050B14' }]}>Commit</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.gitActionBtn, { backgroundColor: '#c084fc' }]} 
                onPress={handlePush}
                disabled={gitExecuting}
              >
                <Ionicons name="cloud-upload-outline" size={16} color="#050B14" />
                <Text style={[styles.gitActionBtnText, { color: '#050B14' }]}>Push</Text>
              </TouchableOpacity>

              {gitExecuting && (
                <ActivityIndicator size="small" color="#00e1ff" style={{ marginLeft: 8 }} />
              )}
            </View>
          </GlassContainer>
        </View>
      ) : activeTab === 'terminal' ? (
        <View style={styles.terminalView}>
          <ScrollView
            ref={terminalScrollRef}
            style={styles.terminalScroll}
            contentContainerStyle={styles.terminalContent}
            showsVerticalScrollIndicator={true}
          >
            {terminalHistory.map((item, idx) => {
              let textStyle = styles.termTextNormal;
              if (item.type === 'cmd') textStyle = styles.termTextCmd;
              else if (item.type === 'error') textStyle = styles.termTextError;
              else if (item.type === 'info') textStyle = styles.termTextInfo;

              return (
                <View key={idx} style={styles.terminalLineWrapper}>
                  <Text style={[styles.terminalText, textStyle]}>{item.text}</Text>
                </View>
              );
            })}
            {runningCmd && (
              <View style={styles.runningIndicatorRow}>
                <ActivityIndicator size="small" color="#00e1ff" />
                <Text style={styles.runningText}>Executing command...</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.quickActionsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionsScroll}>
              {[
                { label: 'git status', cmd: 'git status -s' },
                { label: 'git diff', cmd: 'git diff' },
                { label: 'git pull', cmd: 'git pull' },
                { label: 'git add .', cmd: 'git add .' },
                { label: 'git commit', cmd: 'git commit -m "vibe coding"' },
                { label: 'npm test', cmd: 'npm test' },
                { label: 'npm run lint', cmd: 'npm run lint' },
                { label: 'ls -la', cmd: 'ls -la' }
              ].map((action, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.quickActionBtn}
                  onPress={() => handleRunCommand(action.cmd)}
                  disabled={runningCmd}
                >
                  <Text style={styles.quickActionText}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <GlassContainer style={styles.inputContainer} intensity={40}>
            <TextInput
              style={styles.input}
              placeholder="Type shell command..."
              placeholderTextColor="#64748b"
              value={terminalInput}
              onChangeText={setTerminalInput}
              onSubmitEditing={() => handleRunCommand()}
              autoCapitalize="none"
              autoCorrect={false}
              disabled={runningCmd}
            />
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={() => handleRunCommand()}
              disabled={runningCmd || !terminalInput.trim()}
            >
              <Ionicons name="play" size={18} color="#050B14" />
            </TouchableOpacity>
          </GlassContainer>
        </View>
      ) : (
        /* AI Agent Chat View */
        <View style={styles.terminalView}>
          <View style={styles.agentToolbar}>
            <TouchableOpacity style={styles.toolbarBtn} onPress={handleManualCompact}>
              <Ionicons name="cut-outline" size={16} color="#00e1ff" />
              <Text style={styles.toolbarBtnText}>Compact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[styles.toolbarBtn, autoCompact && styles.toolbarBtnActive]} 
              onPress={() => setAutoCompact(prev => !prev)}
            >
              <Ionicons name={autoCompact ? "checkbox-outline" : "square-outline"} size={16} color={autoCompact ? "#00e1ff" : "#64748b"} />
              <Text style={[styles.toolbarBtnText, autoCompact && { color: '#00e1ff' }]}>Auto-Compact</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.toolbarBtn} onPress={() => setShowTimeline(true)}>
              <Ionicons name="time-outline" size={16} color="#c084fc" />
              <Text style={[styles.toolbarBtnText, { color: '#c084fc' }]}>Timeline</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            ref={agentScrollRef}
            style={styles.terminalScroll}
            contentContainerStyle={styles.terminalContent}
            showsVerticalScrollIndicator={true}
          >
            {agentMessages.map((msg) => {
              const isUser = msg.role === 'user';
              const isInfo = msg.type === 'info';
              const isToolStart = msg.type === 'tool_start';
              const isToolEnd = msg.type === 'tool_end';
              const isError = msg.type === 'error';

              if (isInfo) {
                return (
                  <View key={msg.id} style={styles.agentInfoRow}>
                    <Ionicons name="information-circle-outline" size={14} color="#a855f7" />
                    <Text style={styles.agentInfoText}>{msg.content}</Text>
                  </View>
                );
              }

              if (isError) {
                return (
                  <View key={msg.id} style={styles.agentErrorRow}>
                    <Ionicons name="alert-circle-outline" size={16} color="#f87171" />
                    <Text style={styles.agentErrorText}>{msg.content}</Text>
                  </View>
                );
              }

              if (isToolStart) {
                return (
                  <View key={msg.id} style={styles.toolStartRow}>
                    <Text style={styles.toolStartText}>{msg.content}</Text>
                    {msg.details ? <Text style={styles.toolDetailsText}>{msg.details}</Text> : null}
                  </View>
                );
              }

              if (isToolEnd) {
                const isExpanded = !!expandedTools[msg.id];
                return (
                  <View key={msg.id} style={styles.toolEndContainer}>
                    <TouchableOpacity 
                      style={styles.toolEndHeader} 
                      onPress={() => toggleToolExpand(msg.id)}
                      activeOpacity={0.8}
                    >
                      <View style={styles.toolTitleRow}>
                        <Ionicons name={isExpanded ? "chevron-down" : "chevron-forward"} size={14} color="#4ade80" />
                        <Text style={styles.toolEndText}>{msg.content}</Text>
                      </View>
                      <Text style={styles.tapToViewText}>{isExpanded ? "collapse" : "expand"}</Text>
                    </TouchableOpacity>
                    {isExpanded && (
                      <ScrollView style={styles.toolOutputScroll} horizontal showsHorizontalScrollIndicator={true}>
                        <Text style={styles.toolOutputText}>{msg.details}</Text>
                      </ScrollView>
                    )}
                  </View>
                );
              }

              return (
                <FadeIn key={msg.id} delay={50} style={isUser ? styles.userMsgWrapper : styles.agentMsgWrapper}>
                  <View style={[styles.chatBubble, isUser ? styles.userBubble : styles.agentBubble]}>
                    {!isUser && (
                      <LinearGradient colors={['#0B192C', '#1E3E62']} style={StyleSheet.absoluteFill} borderRadius={16} />
                    )}
                    {isUser && (
                      <LinearGradient colors={['rgba(0, 225, 255, 0.1)', 'rgba(0, 225, 255, 0.02)']} style={StyleSheet.absoluteFill} borderRadius={16} />
                    )}
                    <View style={styles.chatContent}>
                      {!isUser && <Ionicons name="sparkles" size={16} color="#00e1ff" style={styles.aiIcon} />}
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.chatText, isUser && styles.userChatText]}>{msg.content}</Text>
                        {isUser && msg.commitHash ? (
                          <Text style={styles.commitHashText}>
                            Checkpoint: {msg.commitHash.substring(0, 7)}
                          </Text>
                        ) : null}
                      </View>
                      {isUser && (
                        <TouchableOpacity 
                          style={styles.rewindBubbleBtn} 
                          onPress={() => handleRewind(msg.id, msg.commitHash)}
                          activeOpacity={0.7}
                        >
                          <Ionicons name="time" size={16} color="#c084fc" />
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </FadeIn>
              );
            })}
            {agentRunning && (
              <View style={styles.runningIndicatorRow}>
                <ActivityIndicator size="small" color="#00e1ff" />
                <Text style={styles.runningText}>Agent is executing loop...</Text>
              </View>
            )}
          </ScrollView>

          {/* Agent Input Bar */}
          <GlassContainer style={styles.inputContainer} intensity={40}>
            <TextInput
              style={styles.input}
              placeholder="Ask the Agent to do a task..."
              placeholderTextColor="#64748b"
              value={agentPrompt}
              onChangeText={setAgentPrompt}
              onSubmitEditing={handleSendAgentTask}
              autoCapitalize="none"
              autoCorrect={false}
              disabled={agentRunning}
            />
            <TouchableOpacity 
              style={styles.sendButton} 
              onPress={handleSendAgentTask}
              disabled={agentRunning || !agentPrompt.trim()}
            >
              <Ionicons name="arrow-up" size={18} color="#050B14" />
            </TouchableOpacity>
          </GlassContainer>
        </View>
      )}

      <Modal
        visible={showTimeline}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTimeline(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderTitleRow}>
                <Ionicons name="time" size={20} color="#c084fc" />
                <Text style={styles.modalTitle}>Checkpoint Timeline</Text>
              </View>
              <TouchableOpacity onPress={() => setShowTimeline(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={22} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalScrollContent}>
              {agentMessages.filter(m => m.role === 'user').length === 0 ? (
                <View style={styles.emptyTimelineContainer}>
                  <Ionicons name="hourglass-outline" size={48} color="#475569" />
                  <Text style={styles.emptyTimelineText}>No checkpoints recorded yet.</Text>
                  <Text style={styles.emptyTimelineSubtext}>Start chatting with the agent to automatically create checkpoints.</Text>
                </View>
              ) : (
                agentMessages
                  .filter(m => m.role === 'user')
                  .reverse()
                  .map((msg, index) => (
                    <View key={msg.id} style={styles.timelineItem}>
                      <View style={styles.timelineHeaderRow}>
                        <Text style={styles.timelineStepNumber}>Checkpoint #{agentMessages.filter(m => m.role === 'user').length - index}</Text>
                        {msg.commitHash ? (
                          <View style={styles.timelineHashBadge}>
                            <Ionicons name="git-commit" size={12} color="#c084fc" />
                            <Text style={styles.timelineHashText}>{msg.commitHash.substring(0, 7)}</Text>
                          </View>
                        ) : (
                          <View style={[styles.timelineHashBadge, { backgroundColor: 'rgba(255, 255, 255, 0.05)' }]}>
                            <Text style={[styles.timelineHashText, { color: '#64748b' }]}>Chat Only</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.timelinePromptText} numberOfLines={3}>{msg.content}</Text>
                      <TouchableOpacity
                        style={styles.timelineRewindBtn}
                        onPress={() => {
                          setShowTimeline(false);
                          setTimeout(() => {
                            handleRewind(msg.id, msg.commitHash);
                          }, 300);
                        }}
                      >
                        <Ionicons name="play-back" size={14} color="#050B14" />
                        <Text style={styles.timelineRewindBtnText}>Rewind to here</Text>
                      </TouchableOpacity>
                    </View>
                  ))
              )}
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
  repoStickyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'rgba(5, 11, 20, 0.9)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  repoStickyText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  refreshBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00e1ff',
  },
  tabText: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#00e1ff',
  },
  gitView: {
    flex: 1,
    flexDirection: 'row',
  },
  explorer: {
    width: 140,
    borderRadius: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    marginRight: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  explorerTitle: {
    color: '#64748b',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  cleanTreeText: {
    color: '#4ade80',
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
    paddingVertical: 4,
  },
  fileItemActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    paddingHorizontal: 6,
    borderRadius: 6,
    marginLeft: -6,
    marginRight: -6,
  },
  fileStatusBadge: {
    fontFamily: 'monospace',
    fontWeight: '700',
    fontSize: 12,
    width: 20,
    textAlign: 'center',
  },
  fileName: {
    color: '#94a3b8',
    fontSize: 12,
    flex: 1,
  },
  fileNameActive: {
    color: '#ffffff',
    fontWeight: '600',
  },
  diffContainer: {
    flex: 1,
    backgroundColor: '#030712',
  },
  diffHeader: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  diffTitle: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  diffScroll: {
    flex: 1,
  },
  diffContent: {
    padding: 16,
  },
  diffLine: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  diffNormal: {
    color: '#cbd5e1',
  },
  diffAddition: {
    color: '#4ade80',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
  },
  diffDeletion: {
    color: '#f87171',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
  },
  diffMeta: {
    color: '#a855f7',
    fontWeight: '600',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    color: '#64748b',
    marginTop: 10,
    fontSize: 14,
  },
  noFileSelectedText: {
    color: '#475569',
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
  },
  terminalView: {
    flex: 1,
    backgroundColor: '#030712',
  },
  terminalScroll: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  terminalContent: {
    paddingBottom: 20,
  },
  terminalLineWrapper: {
    marginBottom: 8,
  },
  terminalText: {
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 20,
  },
  termTextNormal: {
    color: '#cbd5e1',
  },
  termTextCmd: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  termTextError: {
    color: '#f87171',
  },
  termTextInfo: {
    color: '#a855f7',
    fontStyle: 'italic',
  },
  runningIndicatorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 10,
  },
  runningText: {
    color: '#64748b',
    fontFamily: 'monospace',
    fontSize: 12,
  },
  quickActionsContainer: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.05)',
    backgroundColor: 'rgba(5, 11, 20, 0.5)',
    paddingVertical: 10,
  },
  quickActionsScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  quickActionBtn: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickActionText: {
    color: '#cbd5e1',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  inputContainer: {
    margin: 16,
    padding: 6,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    height: 40,
    paddingHorizontal: 12,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  sendButton: {
    backgroundColor: '#00e1ff',
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },

  // Agent chat styles
  agentInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 8,
    backgroundColor: 'rgba(168, 85, 247, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.2)',
  },
  agentInfoText: {
    color: '#c084fc',
    fontSize: 12,
    fontStyle: 'italic',
  },
  agentErrorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    marginVertical: 8,
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.2)',
  },
  agentErrorText: {
    color: '#f87171',
    fontSize: 12,
    fontWeight: '600',
  },
  toolStartRow: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 10,
    padding: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    maxWidth: '90%',
  },
  toolStartText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  toolDetailsText: {
    color: '#64748b',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
  },
  toolEndContainer: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
    borderRadius: 10,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(74, 222, 128, 0.15)',
    maxWidth: '90%',
    overflow: 'hidden',
  },
  toolEndHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(74, 222, 128, 0.05)',
    width: '100%',
    gap: 20,
  },
  toolTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  toolEndText: {
    color: '#4ade80',
    fontSize: 12,
    fontWeight: '700',
    fontFamily: 'monospace',
  },
  tapToViewText: {
    color: '#64748b',
    fontSize: 10,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  toolOutputScroll: {
    maxHeight: 150,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    borderTopWidth: 1,
    borderTopColor: 'rgba(74, 222, 128, 0.15)',
  },
  toolOutputText: {
    padding: 10,
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 11,
  },
  userMsgWrapper: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    marginVertical: 6,
  },
  agentMsgWrapper: {
    alignSelf: 'flex-start',
    maxWidth: '85%',
    marginVertical: 6,
  },
  chatBubble: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
  },
  userBubble: {
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  agentBubble: {
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  chatContent: {
    padding: 14,
    flexDirection: 'row',
  },
  aiIcon: {
    marginRight: 10,
    marginTop: 2,
  },
  chatText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  userChatText: {
    color: '#ffffff',
  },
  commitHashText: {
    color: '#c084fc',
    fontFamily: 'monospace',
    fontSize: 10,
    marginTop: 6,
    opacity: 0.8,
  },
  rewindBubbleBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    borderRadius: 6,
    height: 28,
    width: 28,
  },
  agentToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  toolbarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  toolbarBtnActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderColor: 'rgba(0, 225, 255, 0.2)',
    borderWidth: 1,
  },
  toolbarBtnText: {
    color: '#94a3b8',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 11, 20, 0.85)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#050B14',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    maxHeight: '80%',
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  modalHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  modalScrollContent: {
    padding: 20,
    gap: 16,
  },
  emptyTimelineContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  emptyTimelineText: {
    color: '#cbd5e1',
    fontSize: 15,
    fontWeight: '600',
  },
  emptyTimelineSubtext: {
    color: '#64748b',
    fontSize: 13,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  timelineItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    gap: 12,
  },
  timelineHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  timelineStepNumber: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  timelineHashBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192, 132, 252, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  timelineHashText: {
    color: '#c084fc',
    fontFamily: 'monospace',
    fontSize: 11,
    fontWeight: '700',
  },
  timelinePromptText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
  },
  timelineRewindBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: '#00e1ff',
    borderRadius: 10,
    paddingVertical: 10,
    marginTop: 4,
  },
  timelineRewindBtnText: {
    color: '#050B14',
    fontSize: 13,
    fontWeight: '700',
  },
  commitPanel: {
    margin: 16,
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  commitInput: {
    color: '#ffffff',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: 'monospace',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 10,
  },
  commitActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  gitActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flex: 1,
  },
  gitActionBtnText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  explorerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  explorerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 6,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  explorerToggleBtn: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 4,
  },
  explorerToggleBtnActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
  },
  viewModeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  viewModeToggleBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  viewModeToggleBtnActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
  },
  viewModeToggleText: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  editorContent: {
    flexDirection: 'row',
    padding: 16,
  },
  lineNumbers: {
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'flex-end',
  },
  lineNumber: {
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
  codeArea: {
    paddingLeft: 16,
  },
  codeLine: {
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 12,
    lineHeight: 18,
  },
});

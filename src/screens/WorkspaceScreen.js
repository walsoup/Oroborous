import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import { LinearGradient } from 'expo-linear-gradient';

export default function WorkspaceScreen({ route }) {
  const repoName = route.params?.repo?.name || 'workspace';
  const [activeTab, setActiveTab] = useState('chat');
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', role: 'system', content: `Oroborous Agent initialized in ${repoName}.\nReady to vibe code.` }
  ]);

  const mockCode = `import React from 'react';\nimport { View, Text } from 'react-native';\n\nexport default function App() {\n  return (\n    <View style={{ flex: 1 }}>\n      <Text>Hello World</Text>\n    </View>\n  );\n}`;
  const codeLines = mockCode.split('\n');

  const handleSend = () => {
    if (prompt.trim()) {
      setMessages([...messages, { id: Date.now().toString(), role: 'user', content: prompt }]);
      setPrompt('');
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'Analyzing dependency tree...\nGenerating AST for modifications...\nApplying diffs to target file.' }]);
      }, 800);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.repoStickyHeader}>
        <Ionicons name="git-branch-outline" size={16} color="#00e1ff" />
        <Text style={styles.repoStickyText}>{repoName} <Text style={{color: '#64748b'}}>(main)</Text></Text>
      </View>

      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'code' && styles.activeTab]}
          onPress={() => setActiveTab('code')}
        >
          <Ionicons name="code-slash" size={20} color={activeTab === 'code' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}>Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="terminal-outline" size={20} color={activeTab === 'chat' ? '#00e1ff' : '#64748b'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Agent CLI</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'code' ? (
        <FadeIn delay={0} style={styles.codeView}>
          <GlassContainer style={styles.explorer} intensity={30}>
            <Text style={styles.explorerTitle}>Explorer</Text>
            <View style={styles.fileItemActive}>
              <Ionicons name="logo-react" size={16} color="#00e1ff" />
              <Text style={styles.fileNameActive}>App.js</Text>
            </View>
            <View style={styles.fileItem}>
              <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
              <Text style={styles.fileName}>package.json</Text>
            </View>
          </GlassContainer>
          <View style={styles.editor}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.editorContent}>
                <View style={styles.lineNumbers}>
                  {codeLines.map((_, i) => (
                    <Text key={i} style={styles.lineNumber}>{i + 1}</Text>
                  ))}
                </View>
                <View style={styles.codeArea}>
                  {codeLines.map((line, i) => (
                    <Text key={i} style={styles.codeLine}>{line}</Text>
                  ))}
                </View>
              </View>
            </ScrollView>
          </View>
        </FadeIn>
      ) : (
        <View style={styles.chatView}>
          <ScrollView contentContainerStyle={styles.messagesContainer}>
            {messages.map((msg, idx) => (
              <FadeIn key={msg.id} delay={100}>
                <View style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                  {msg.role !== 'user' && (
                    <LinearGradient colors={['#0B192C', '#1E3E62']} style={StyleSheet.absoluteFill} borderRadius={16} />
                  )}
                  {msg.role === 'user' && (
                    <LinearGradient colors={['rgba(0, 225, 255, 0.1)', 'rgba(0, 225, 255, 0.02)']} style={StyleSheet.absoluteFill} borderRadius={16} />
                  )}
                  <View style={styles.messageContent}>
                    {msg.role !== 'user' && <Ionicons name="terminal" size={16} color="#00e1ff" style={styles.aiIcon} />}
                    <Text style={[styles.messageText, msg.role === 'user' && styles.userMessageText]}>{msg.content}</Text>
                  </View>
                </View>
              </FadeIn>
            ))}
          </ScrollView>

          <GlassContainer style={styles.inputContainer} intensity={40}>
            <TextInput
              style={styles.input}
              placeholder="Deploy agent to vibe code..."
              placeholderTextColor="#64748b"
              value={prompt}
              onChangeText={setPrompt}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Ionicons name="arrow-up" size={20} color="#050B14" />
            </TouchableOpacity>
          </GlassContainer>
        </View>
      )}
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: 'rgba(5, 11, 20, 0.8)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 8,
  },
  repoStickyText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#00e1ff',
  },
  tabText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  activeTabText: {
    color: '#00e1ff',
  },
  codeView: {
    flex: 1,
    flexDirection: 'row',
  },
  explorer: {
    width: 130,
    borderRadius: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
    marginRight: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  explorerTitle: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  fileItemActive: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    padding: 6,
    borderRadius: 6,
    marginLeft: -6,
  },
  fileName: {
    color: '#94a3b8',
    fontSize: 13,
  },
  fileNameActive: {
    color: '#00e1ff',
    fontSize: 13,
    fontWeight: '600',
  },
  editor: {
    flex: 1,
    backgroundColor: '#0B1423',
  },
  editorContent: {
    flexDirection: 'row',
    padding: 16,
  },
  lineNumbers: {
    paddingRight: 16,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'flex-end',
  },
  lineNumber: {
    color: '#475569',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 24,
  },
  codeArea: {
    paddingLeft: 16,
  },
  codeLine: {
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    lineHeight: 24,
  },
  chatView: {
    flex: 1,
  },
  messagesContainer: {
    padding: 20,
    gap: 16,
    paddingBottom: 20,
  },
  messageBubble: {
    borderRadius: 16,
    maxWidth: '90%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  aiBubble: {
    alignSelf: 'flex-start',
  },
  messageContent: {
    padding: 16,
    flexDirection: 'row',
  },
  aiIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  messageText: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 22,
    flex: 1,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  userMessageText: {
    color: '#ffffff',
  },
  inputContainer: {
    margin: 16,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderRadius: 20,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 15,
  },
  sendButton: {
    backgroundColor: '#00e1ff',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
});

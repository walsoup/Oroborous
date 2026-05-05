import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';

export default function WorkspaceScreen({ route }) {
  const repoName = route.params?.repo?.name || 'workspace';
  const [activeTab, setActiveTab] = useState('chat'); // 'code' | 'chat'
  const [prompt, setPrompt] = useState('');
  const [messages, setMessages] = useState([
    { id: '1', role: 'system', content: `Welcome to ${repoName}. I'm your AI agent. How can I help you code today?` }
  ]);

  const handleSend = () => {
    if (prompt.trim()) {
      setMessages([...messages, { id: Date.now().toString(), role: 'user', content: prompt }]);
      setPrompt('');
      // Simulate AI response
      setTimeout(() => {
        setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: 'I am analyzing your request and preparing the code changes.' }]);
      }, 1000);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'code' && styles.activeTab]}
          onPress={() => setActiveTab('code')}
        >
          <Ionicons name="code-slash" size={20} color={activeTab === 'code' ? '#22d3ee' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'code' && styles.activeTabText]}>Code</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'chat' && styles.activeTab]}
          onPress={() => setActiveTab('chat')}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={activeTab === 'chat' ? '#22d3ee' : '#94a3b8'} />
          <Text style={[styles.tabText, activeTab === 'chat' && styles.activeTabText]}>Agent</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'code' ? (
        <View style={styles.codeView}>
          <GlassContainer style={styles.explorer}>
            <Text style={styles.explorerTitle}>Explorer</Text>
            <View style={styles.fileItem}>
              <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
              <Text style={styles.fileName}>App.js</Text>
            </View>
            <View style={styles.fileItem}>
              <Ionicons name="document-text-outline" size={16} color="#94a3b8" />
              <Text style={styles.fileName}>package.json</Text>
            </View>
          </GlassContainer>
          <View style={styles.editor}>
            <Text style={styles.codeText}>
              {`function App() {\n  return (\n    <View>\n      <Text>Hello Mobile IDE</Text>\n    </View>\n  );\n}`}
            </Text>
          </View>
        </View>
      ) : (
        <View style={styles.chatView}>
          <ScrollView contentContainerStyle={styles.messagesContainer}>
            {messages.map(msg => (
              <View key={msg.id} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
                {msg.role !== 'user' && <Ionicons name="sparkles" size={16} color="#22d3ee" style={styles.aiIcon} />}
                <Text style={styles.messageText}>{msg.content}</Text>
              </View>
            ))}
          </ScrollView>
          <GlassContainer style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              placeholder="Vibe code away..."
              placeholderTextColor="#64748b"
              value={prompt}
              onChangeText={setPrompt}
              multiline
            />
            <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
              <Ionicons name="send" size={20} color="#0f172a" />
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
    backgroundColor: '#0f172a',
  },
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#22d3ee',
  },
  tabText: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  activeTabText: {
    color: '#22d3ee',
  },
  codeView: {
    flex: 1,
    flexDirection: 'row',
  },
  explorer: {
    width: 120,
    borderRadius: 0,
    borderRightWidth: 1,
    borderRightColor: 'rgba(255, 255, 255, 0.1)',
    padding: 12,
  },
  explorerTitle: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 16,
    textTransform: 'uppercase',
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  fileName: {
    color: '#cbd5e1',
    fontSize: 14,
  },
  editor: {
    flex: 1,
    padding: 20,
    backgroundColor: '#1e293b',
  },
  codeText: {
    color: '#e2e8f0',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 14,
    lineHeight: 24,
  },
  chatView: {
    flex: 1,
  },
  messagesContainer: {
    padding: 20,
    gap: 16,
  },
  messageBubble: {
    padding: 16,
    borderRadius: 16,
    maxWidth: '85%',
  },
  userBubble: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(34, 211, 238, 0.2)',
  },
  aiBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  aiIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  messageText: {
    color: '#e2e8f0',
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
  },
  inputContainer: {
    margin: 20,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  input: {
    flex: 1,
    color: '#e2e8f0',
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
  },
  sendButton: {
    backgroundColor: '#22d3ee',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
});

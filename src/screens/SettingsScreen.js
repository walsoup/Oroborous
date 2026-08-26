import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  ActivityIndicator,
  Alert,
  Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import BouncyButton from '../components/BouncyButton';
import { api, getServerUrl, setServerUrl, getServerToken, setServerToken } from '../services/api';
import { THEMES, FONTS } from '../theme/theme';
import * as Haptics from 'expo-haptics';

export default function SettingsScreen({ navigation }) {
  const [provider, setProvider] = useState('openrouter');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [primaryModel, setPrimaryModel] = useState('');
  const [subAgentModel, setSubAgentModel] = useState('');
  const [miniAgentModel, setMiniAgentModel] = useState('');
  const [backendUrl, setBackendUrl] = useState(getServerUrl());
  const [serverToken, setServerTokenState] = useState(getServerToken());
  const [isVibeModeEnabled, setIsVibeModeEnabled] = useState(true);
  const [autoApproval, setAutoApproval] = useState(true);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const config = await api.getConfig();
      if (config.aiSettings) {
        setProvider(config.aiSettings.provider || 'openrouter');
        setBaseUrl(config.aiSettings.baseUrl || 'https://openrouter.ai/api/v1');
        setApiKey(config.aiSettings.apiKey || '');
        setPrimaryModel(config.aiSettings.primaryModel || 'anthropic/claude-3.5-sonnet');
        setSubAgentModel(config.aiSettings.subAgentModel || 'meta-llama/llama-3.3-70b-instruct');
        setMiniAgentModel(config.aiSettings.miniAgentModel || 'google/gemini-2.0-flash-001');
        setAutoApproval(config.aiSettings.autoApproval !== false);
      }
      setIsVibeModeEnabled(config.vibeMode !== false);
    } catch (e) {
      console.warn('Failed to load settings', e);
    } finally {
      setLoading(false);
    }
  };

  const handleProviderChange = (p) => {
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setProvider(p);
    if (p === 'openrouter') {
      setBaseUrl('https://openrouter.ai/api/v1');
      setPrimaryModel('anthropic/claude-3.5-sonnet');
      setSubAgentModel('meta-llama/llama-3.3-70b-instruct');
      setMiniAgentModel('google/gemini-2.0-flash-001');
    } else if (p === 'anthropic' || p === 'claude') {
      setBaseUrl('https://api.anthropic.com/v1');
      setPrimaryModel('claude-3-5-sonnet-20241022');
      setSubAgentModel('claude-3-5-haiku-20241022');
      setMiniAgentModel('claude-3-5-haiku-20241022');
    } else if (p === 'openai') {
      setBaseUrl('https://api.openai.com/v1');
      setPrimaryModel('gpt-4o');
      setSubAgentModel('gpt-4o-mini');
      setMiniAgentModel('gpt-4o-mini');
    } else if (p === 'gemini') {
      setBaseUrl('https://generativelanguage.googleapis.com/v1beta');
      setPrimaryModel('gemini-2.0-flash');
      setSubAgentModel('gemini-1.5-flash');
      setMiniAgentModel('gemini-1.5-flash');
    } else if (p === 'deepseek') {
      setBaseUrl('https://api.deepseek.com');
      setPrimaryModel('deepseek-chat');
      setSubAgentModel('deepseek-chat');
      setMiniAgentModel('deepseek-chat');
    } else if (p === 'groq') {
      setBaseUrl('https://api.groq.com/openai/v1');
      setPrimaryModel('llama-3.3-70b-versatile');
      setSubAgentModel('llama-3.1-8b-instant');
      setMiniAgentModel('llama-3.1-8b-instant');
    } else if (p === 'ollama') {
      setBaseUrl('http://localhost:11434');
      setPrimaryModel('llama3.3');
      setSubAgentModel('llama3.1:8b');
      setMiniAgentModel('llama3.1:8b');
    } else if (p === 'custom') {
      setBaseUrl('');
      setPrimaryModel('');
      setSubAgentModel('');
      setMiniAgentModel('');
    }
  };

  const handleTestConnection = async () => {
    setTestingConnection(true);
    try {
      // Persist current form values first so the test exercises THIS config
      // (previously it tested the server's stored key, not the unsaved one)
      await api.saveConfig({
        aiSettings: { provider, baseUrl, apiKey, primaryModel, subAgentModel, miniAgentModel, autoApproval },
        vibeMode: isVibeModeEnabled,
      });

      const pingRes = await api.chatAI({
        messages: [{ role: 'user', content: 'Say "Oroborous Connection OK" and nothing else.' }],
        model: primaryModel,
        systemPrompt: 'Be concise.',
        temperature: 0.1,
        maxTokens: 50
      });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert('Connection Successful!', `AI Response: "${pingRes.content?.trim() || 'Connected'}"`);
    } catch (e) {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('Connection Failed', e.message);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      setServerUrl(backendUrl);
      // Apply the pairing token immediately (persisted inside api service)
      setServerToken(serverToken);

      await api.saveConfig({
        aiSettings: {
          provider,
          baseUrl,
          apiKey,
          primaryModel,
          subAgentModel,
          miniAgentModel,
          autoApproval,
        },
        vibeMode: isVibeModeEnabled,
      });

      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Success', 'Configurations saved successfully!');
    } catch (e) {
      Alert.alert('Save Error', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#00e1ff" />
        <Text style={styles.loadingText}>Loading Settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Backend Section */}
      <FadeIn delay={0}>
        <Text style={styles.sectionTitle}>Backend Bridge</Text>
        <GlassContainer style={styles.sectionCard} intensity={30}>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Server URL</Text>
            <TextInput
              style={styles.input}
              placeholder="http://localhost:3005"
              placeholderTextColor="#94a3b8"
              value={backendUrl}
              onChangeText={setBackendUrl}
              autoCapitalize="none"
            />
          </View>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Server Pairing Token</Text>
            <TextInput
              style={styles.input}
              placeholder="Token from server console output"
              placeholderTextColor="#94a3b8"
              value={serverToken}
              onChangeText={setServerTokenState}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Text style={styles.helperText}>Required. Printed as "Pairing token" when the daemon starts.</Text>
          </View>
          <Text style={styles.helperText}>Point to the Node.js companion daemon running on your computer or VPS (localhost-only by default).</Text>
        </GlassContainer>
      </FadeIn>

      {/* AI Provider Section */}
      <FadeIn delay={50}>
        <Text style={styles.sectionTitle}>AI Model Provider</Text>
        <View style={styles.providerGrid}>
          {[
            { id: 'openrouter', label: 'OpenRouter' },
            { id: 'anthropic', label: 'Claude / Anthropic' },
            { id: 'openai', label: 'OpenAI' },
            { id: 'gemini', label: 'Google Gemini' },
            { id: 'deepseek', label: 'DeepSeek' },
            { id: 'groq', label: 'Groq' },
            { id: 'ollama', label: 'Ollama' },
            { id: 'custom', label: 'Custom' }
          ].map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.providerBtn, provider === p.id && styles.providerBtnActive]}
              onPress={() => handleProviderChange(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerBtnText, provider === p.id && styles.providerBtnTextActive]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </FadeIn>

      {/* Credentials & Models Card */}
      <FadeIn delay={100}>
        <GlassContainer style={styles.sectionCard} intensity={30}>
          <Text style={styles.cardHeading}>{provider.toUpperCase()} Credentials</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Endpoint Base URL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://openrouter.ai/api/v1"
              placeholderTextColor="#94a3b8"
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>API Key / Bearer Token</Text>
            <TextInput
              style={styles.input}
              placeholder="sk-... or auth credential"
              placeholderTextColor="#94a3b8"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <BouncyButton
            style={styles.testBtn}
            onPress={handleTestConnection}
            disabled={testingConnection}
          >
            {testingConnection ? (
              <ActivityIndicator size="small" color="#050B14" />
            ) : (
              <>
                <Ionicons name="flash-outline" size={14} color="#050B14" />
                <Text style={styles.testBtnText}>Test AI Connection</Text>
              </>
            )}
          </BouncyButton>

          <View style={styles.divider} />

          <Text style={styles.cardHeading}>Agent Model Routing</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Primary Agent (Architecture & Logic)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. anthropic/claude-3.5-sonnet"
              placeholderTextColor="#94a3b8"
              value={primaryModel}
              onChangeText={setPrimaryModel}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Sub-Agent (Planning & Task Subtrees)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. meta-llama/llama-3.3-70b-instruct"
              placeholderTextColor="#94a3b8"
              value={subAgentModel}
              onChangeText={setSubAgentModel}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Mini-Agent (Quick Fixes & Fast Edits)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. google/gemini-2.0-flash-001"
              placeholderTextColor="#94a3b8"
              value={miniAgentModel}
              onChangeText={setMiniAgentModel}
              autoCapitalize="none"
            />
          </View>
        </GlassContainer>
      </FadeIn>

      {/* Autonomous Preferences */}
      <FadeIn delay={150}>
        <GlassContainer style={styles.sectionCard} intensity={30}>
          <Text style={styles.cardHeading}>Agent Autonomy Preferences</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.switchTitle}>Vibe Coding Autopilot</Text>
              <Text style={styles.switchDesc}>Allow agent to autonomously write files, stage commits, and execute shell tests</Text>
            </View>
            <Switch
              value={isVibeModeEnabled}
              onValueChange={setIsVibeModeEnabled}
              trackColor={{ false: '#1e293b', true: '#00e1ff' }}
              thumbColor={'#ffffff'}
            />
          </View>
        </GlassContainer>
      </FadeIn>

      {/* About & Tour */}
      <FadeIn delay={200}>
        <GlassContainer style={styles.sectionCard} intensity={30}>
          <Text style={styles.cardHeading}>About Oroborous</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>VERSION</Text>
            <Text style={styles.aboutValue}>v1.2 Stable Release</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>ENGINEER</Text>
            <Text style={styles.aboutValue}>itswal</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>CONTACT</Text>
            <Text style={styles.aboutValue}>me@itswal.me</Text>
          </View>

          <TouchableOpacity
            style={styles.tourBtn}
            onPress={() => navigation.navigate('Onboarding')}
          >
            <Ionicons name="sparkles" size={14} color="#00e1ff" />
            <Text style={styles.tourBtnText}>Replay Onboarding Tour</Text>
          </TouchableOpacity>
        </GlassContainer>
      </FadeIn>

      {/* Save Button */}
      <FadeIn delay={250} style={{ marginBottom: 40, marginTop: 10 }}>
        <BouncyButton
          style={styles.saveButton}
          onPress={handleSaveSettings}
          disabled={saving}
          hapticType="heavy"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#050B14" />
          ) : (
            <Text style={styles.saveButtonText}>Save Configurations</Text>
          )}
        </BouncyButton>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#050B14',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 10,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionCard: {
    padding: 16,
    marginBottom: 20,
  },
  cardHeading: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 14,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  providerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  providerBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  providerBtnActive: {
    backgroundColor: 'rgba(0, 225, 255, 0.1)',
    borderColor: '#00e1ff',
  },
  providerBtnText: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '700',
  },
  providerBtnTextActive: {
    color: '#00e1ff',
  },
  inputGroup: {
    marginBottom: 12,
  },
  inputLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  input: {
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
  helperText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 6,
    lineHeight: 14,
  },
  testBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#00e1ff',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
    marginTop: 6,
  },
  testBtnText: {
    color: '#050B14',
    fontSize: 12,
    fontWeight: '800',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  switchTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 2,
  },
  switchDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  aboutLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '700',
  },
  aboutValue: {
    color: '#00e1ff',
    fontSize: 12,
    fontWeight: '600',
    fontFamily: FONTS.mono,
  },
  tourBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  tourBtnText: {
    color: '#00e1ff',
    fontSize: 12,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: '#00e1ff',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#050B14',
    fontSize: 14,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});

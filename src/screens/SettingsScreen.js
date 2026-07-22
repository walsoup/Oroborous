import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';
import { api, getServerUrl, setServerUrl } from '../services/api';

export default function SettingsScreen({ navigation }) {
  const [provider, setProvider] = useState('ollama');
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [primaryModel, setPrimaryModel] = useState('');
  const [subAgentModel, setSubAgentModel] = useState('');
  const [miniAgentModel, setMiniAgentModel] = useState('');
  const [backendUrl, setBackendUrl] = useState(getServerUrl());
  const [isVibeModeEnabled, setIsVibeModeEnabled] = useState(true);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const config = await api.getConfig();
      if (config.aiSettings) {
        setProvider(config.aiSettings.provider || 'ollama');
        setBaseUrl(config.aiSettings.baseUrl || '');
        setApiKey(config.aiSettings.apiKey || '');
        setPrimaryModel(config.aiSettings.primaryModel || config.aiSettings.model || '');
        setSubAgentModel(config.aiSettings.subAgentModel || '');
        setMiniAgentModel(config.aiSettings.miniAgentModel || '');
      }
      setIsVibeModeEnabled(config.vibeMode !== false);
    } catch (e) {
      console.warn('Failed to load settings from backend', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      setServerUrl(backendUrl);

      await api.saveConfig({
        aiSettings: {
          provider,
          baseUrl,
          apiKey,
          primaryModel,
          subAgentModel,
          miniAgentModel,
        },
        vibeMode: isVibeModeEnabled,
      });

      Alert.alert('Success', 'Settings saved successfully!');
    } catch (e) {
      Alert.alert('Error', e.message || 'Failed to save settings to backend');
    } finally {
      setSaving(false);
    }
  };

  const handleProviderChange = (p) => {
    setProvider(p);
    if (p === 'ollama') {
      setBaseUrl('http://localhost:11434');
      setPrimaryModel('llama3');
      setSubAgentModel('llama3:8b');
      setMiniAgentModel('llama3:8b');
    } else if (p === 'openrouter') {
      setBaseUrl('https://openrouter.ai/api/v1');
      setPrimaryModel('anthropic/claude-3.5-sonnet');
      setSubAgentModel('meta-llama/llama-3-8b-instruct:free');
      setMiniAgentModel('google/gemini-flash-1.5-free');
    } else if (p === 'claude') {
      setBaseUrl('https://api.anthropic.com/v1');
      setPrimaryModel('claude-3-5-sonnet-20241022');
      setSubAgentModel('claude-3-5-haiku-20241022');
      setMiniAgentModel('claude-3-5-haiku-20241022');
    } else if (p === 'gemini') {
      setBaseUrl('https://generativelanguage.googleapis.com/v1beta');
      setPrimaryModel('gemini-1.5-pro');
      setSubAgentModel('gemini-1.5-flash');
      setMiniAgentModel('gemini-1.5-flash');
    } else if (p === 'custom') {
      setBaseUrl('');
      setPrimaryModel('');
      setSubAgentModel('');
      setMiniAgentModel('');
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
      <FadeIn delay={0}>
        <Text style={styles.sectionTitle}>Backend Connection</Text>
      </FadeIn>

      <FadeIn delay={50}>
        <GlassContainer style={styles.formContainer} intensity={30}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>BACKEND SERVER URL</Text>
            <TextInput
              style={styles.input}
              placeholder="http://localhost:3005"
              placeholderTextColor="#64748b"
              value={backendUrl}
              onChangeText={setBackendUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>
              Point the mobile client to the Node.js server running on your development machine.
            </Text>
          </View>
        </GlassContainer>
      </FadeIn>

      <FadeIn delay={100}>
        <Text style={styles.sectionTitle}>AI Integration Engine</Text>
      </FadeIn>

      <FadeIn delay={150}>
        <View style={styles.providerOptions}>
          {[
            { id: 'ollama', label: 'Ollama' },
            { id: 'openrouter', label: 'OpenRouter' },
            { id: 'claude', label: 'Claude' },
            { id: 'gemini', label: 'Gemini' },
            { id: 'custom', label: 'Custom API' }
          ].map(p => (
            <TouchableOpacity
              key={p.id}
              style={[styles.providerButton, provider === p.id && styles.activeProvider]}
              onPress={() => handleProviderChange(p.id)}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerText, provider === p.id && styles.activeProviderText]}>{p.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={200}>
        <GlassContainer style={styles.formContainer} intensity={30}>
          <Text style={styles.formTitle}>
            {provider === 'custom' ? 'OpenAI-Compatible Endpoint' : `${provider.toUpperCase()} credentials`}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>BASE URL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. https://api.openai.com/v1"
              placeholderTextColor="#64748b"
              value={baseUrl}
              onChangeText={setBaseUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>API KEY</Text>
            <TextInput
              style={styles.input}
              placeholder="sk-... or credential token"
              placeholderTextColor="#64748b"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          <View style={styles.divider} />

          <Text style={styles.formSubtitle}>Model Selection</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>PRIMARY AGENT MODEL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. claude-3-5-sonnet, llama3-70b"
              placeholderTextColor="#64748b"
              value={primaryModel}
              onChangeText={setPrimaryModel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Used for complex tasks, architecture, and coding loops.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>SUB-AGENT MODEL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. gemini-1.5-flash, llama3-8b"
              placeholderTextColor="#64748b"
              value={subAgentModel}
              onChangeText={setSubAgentModel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Used for planning, task breakdown, and sub-agents.</Text>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>MINI-AGENT MODEL</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. llama3-8b, qwen-1.5b"
              placeholderTextColor="#64748b"
              value={miniAgentModel}
              onChangeText={setMiniAgentModel}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.helperText}>Fast, cheap model used for small edits and quick fixes.</Text>
          </View>
        </GlassContainer>
      </FadeIn>

      <FadeIn delay={250}>
        <GlassContainer style={styles.preferencesContainer} intensity={30}>
          <Text style={styles.formTitle}>IDE Preferences</Text>
          <View style={styles.prefRow}>
            <View style={{ flex: 1, marginRight: 10 }}>
              <Text style={styles.prefTitle}>Vibe Coding Mode</Text>
              <Text style={styles.prefDesc}>Allow AI agent to autonomously stage commits and modify files directly</Text>
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

      <FadeIn delay={275}>
        <GlassContainer style={styles.preferencesContainer} intensity={30}>
          <Text style={styles.formTitle}>About Oroborous</Text>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>VERSION</Text>
            <Text style={styles.aboutValue}>v1.1 Stable Dev Release</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>DEVELOPER</Text>
            <Text style={styles.aboutValue}>itswal</Text>
          </View>
          <View style={styles.aboutRow}>
            <Text style={styles.aboutLabel}>CONTACT</Text>
            <Text style={styles.aboutValue}>me@itswal.me</Text>
          </View>
          <TouchableOpacity
            style={styles.replayOnboardingBtn}
            onPress={() => navigation.navigate('Onboarding')}
            activeOpacity={0.8}
          >
            <Ionicons name="sparkles-outline" size={16} color="#00e1ff" />
            <Text style={styles.replayOnboardingText}>Replay Onboarding Tour</Text>
          </TouchableOpacity>
        </GlassContainer>
      </FadeIn>

      <FadeIn delay={300} style={{ marginBottom: 40 }}>
        <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings} disabled={saving} activeOpacity={0.8}>
          {saving ? (
            <ActivityIndicator size="small" color="#050B14" />
          ) : (
            <Text style={styles.saveButtonText}>Save Configurations</Text>
          )}
        </TouchableOpacity>
      </FadeIn>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
    padding: 20,
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
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  providerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  providerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  activeProvider: {
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    borderColor: '#00e1ff',
  },
  providerText: {
    color: '#64748b',
    fontWeight: '700',
    fontSize: 13,
  },
  activeProviderText: {
    color: '#00e1ff',
  },
  formContainer: {
    marginBottom: 24,
    padding: 20,
  },
  preferencesContainer: {
    marginBottom: 24,
    padding: 20,
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 20,
    letterSpacing: 0.5,
  },
  formSubtitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    fontSize: 14,
  },
  helperText: {
    color: '#64748b',
    fontSize: 11,
    marginTop: 4,
    lineHeight: 14,
  },
  saveButton: {
    backgroundColor: '#00e1ff',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#00e1ff',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  saveButtonText: {
    color: '#050B14',
    fontWeight: '800',
    fontSize: 15,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  prefRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  prefTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 4,
  },
  prefDesc: {
    color: '#64748b',
    fontSize: 12,
    lineHeight: 16,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  aboutLabel: {
    color: '#64748b',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  aboutValue: {
    color: '#00e1ff',
    fontSize: 13,
    fontWeight: '600',
  },
  replayOnboardingBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 225, 255, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0, 225, 255, 0.2)',
  },
  replayOnboardingText: {
    color: '#00e1ff',
    fontSize: 13,
    fontWeight: '700',
  },
});

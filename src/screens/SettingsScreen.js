import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';
import FadeIn from '../components/FadeIn';

export default function SettingsScreen() {
  const [provider, setProvider] = useState('Claude');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [isVibeModeEnabled, setIsVibeModeEnabled] = useState(true);

  return (
    <ScrollView style={styles.container}>
      <FadeIn delay={0}>
        <Text style={styles.sectionTitle}>AI Integration Engine</Text>
      </FadeIn>

      <FadeIn delay={100}>
        <View style={styles.providerOptions}>
          {['Claude', 'Gemini', 'Copilot', 'Custom'].map(p => (
            <TouchableOpacity
              key={p}
              style={[styles.providerButton, provider === p && styles.activeProvider]}
              onPress={() => setProvider(p)}
              activeOpacity={0.8}
            >
              <Text style={[styles.providerText, provider === p && styles.activeProviderText]}>{p}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </FadeIn>

      <FadeIn delay={200}>
        <GlassContainer style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {provider === 'Custom' ? 'OpenAI-Compatible Endpoint' : `${provider} Native Connection`}
          </Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>BASE URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://api.openai.com/v1"
              placeholderTextColor="#64748b"
              value={apiUrl}
              onChangeText={setApiUrl}
              autoCapitalize="none"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>API KEY</Text>
            <TextInput
              style={styles.input}
              placeholder="sk-..."
              placeholderTextColor="#64748b"
              value={apiKey}
              onChangeText={setApiKey}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>

          <TouchableOpacity style={styles.saveButton} activeOpacity={0.8}>
            <Text style={styles.saveButtonText}>Initialize Connection</Text>
          </TouchableOpacity>
        </GlassContainer>
      </FadeIn>

      <FadeIn delay={300}>
        <GlassContainer style={styles.preferencesContainer}>
          <Text style={styles.formTitle}>IDE Preferences</Text>
          <View style={styles.prefRow}>
            <View>
              <Text style={styles.prefTitle}>Vibe Mode</Text>
              <Text style={styles.prefDesc}>Allow Agent to autonomously stage commits</Text>
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
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  providerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  providerButton: {
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeProvider: {
    backgroundColor: 'rgba(0, 225, 255, 0.15)',
    borderColor: '#00e1ff',
  },
  providerText: {
    color: '#94a3b8',
    fontWeight: '600',
  },
  activeProviderText: {
    color: '#00e1ff',
  },
  formContainer: {
    marginBottom: 24,
  },
  preferencesContainer: {
    marginBottom: 40,
  },
  formTitle: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 24,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
    letterSpacing: 1,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#ffffff',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    fontSize: 15,
  },
  saveButton: {
    backgroundColor: '#00e1ff',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
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
    fontWeight: '600',
    marginBottom: 4,
  },
  prefDesc: {
    color: '#64748b',
    fontSize: 13,
  },
});

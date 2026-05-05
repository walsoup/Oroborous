import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from '../components/GlassContainer';

export default function SettingsScreen() {
  const [provider, setProvider] = useState('Claude');
  const [apiUrl, setApiUrl] = useState('');
  const [apiKey, setApiKey] = useState('');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.sectionTitle}>AI Provider</Text>

      <View style={styles.providerOptions}>
        {['Claude', 'Gemini', 'Copilot', 'Custom'].map(p => (
          <TouchableOpacity
            key={p}
            style={[styles.providerButton, provider === p && styles.activeProvider]}
            onPress={() => setProvider(p)}
          >
            <Text style={[styles.providerText, provider === p && styles.activeProviderText]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <GlassContainer style={styles.formContainer}>
        <Text style={styles.formTitle}>
          {provider === 'Custom' ? 'Custom OpenAI-Compatible API' : `${provider} Settings`}
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>Base URL</Text>
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
          <Text style={styles.label}>API Key</Text>
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

        <TouchableOpacity style={styles.saveButton}>
          <Text style={styles.saveButtonText}>Save Settings</Text>
        </TouchableOpacity>
      </GlassContainer>

      <View style={styles.infoSection}>
        <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
        <Text style={styles.infoText}>
          Use any OpenAI-compatible API by selecting 'Custom' and entering your endpoint and key.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 16,
  },
  providerOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  providerButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activeProvider: {
    backgroundColor: 'rgba(34, 211, 238, 0.1)',
    borderColor: '#22d3ee',
  },
  providerText: {
    color: '#94a3b8',
    fontWeight: '500',
  },
  activeProviderText: {
    color: '#22d3ee',
  },
  formContainer: {
    padding: 20,
    marginBottom: 24,
  },
  formTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    color: '#cbd5e1',
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#e2e8f0',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  saveButton: {
    backgroundColor: '#22d3ee',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 16,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderRadius: 12,
  },
  infoText: {
    color: '#94a3b8',
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
});

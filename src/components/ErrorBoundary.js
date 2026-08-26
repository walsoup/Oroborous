import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GlassContainer from './GlassContainer';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    console.error('Uncaught Error Boundary Exception:', error, errorInfo);
  }

  handleSendEmail = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (_) {}

    const subject = encodeURIComponent('Oroborous App Error Report (v2.0)');
    const errorDetails = this.state.error ? this.state.error.toString() : 'Unknown Error';
    const stackDetails = this.state.errorInfo ? this.state.errorInfo.componentStack : '';
    
    const body = encodeURIComponent(
      `Hi itswal,\n\nI encountered an error in Oroborous v2.0:\n\n` +
      `--- ERROR DETAILS ---\n${errorDetails}\n\n` +
      `--- COMPONENT STACK ---\n${stackDetails}\n\n` +
      `--- DEVICE ENVIRONMENT ---\n` +
      `Platform: Android / Mobile\n` +
      `Date: ${new Date().toISOString()}\n`
    );

    const mailUrl = `mailto:me@itswal.me?subject=${subject}&body=${body}`;

    Linking.canOpenURL(mailUrl)
      .then((supported) => {
        if (supported) {
          Linking.openURL(mailUrl);
        } else {
          Alert.alert('Email Client Not Available', `Please email your error report to: me@itswal.me\n\nError: ${errorDetails}`);
        }
      })
      .catch(() => {
        Alert.alert('Developer Contact', `Send error reports to: me@itswal.me`);
      });
  };

  handleReset = () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (_) {}
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <LinearGradient colors={['#050B14', '#111827', '#1f2937']} style={StyleSheet.absoluteFill} />
          
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            <GlassContainer style={styles.card} intensity={40}>
              <View style={styles.headerRow}>
                <View style={styles.iconCircle}>
                  <Ionicons name="alert-circle" size={32} color="#ef4444" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>An Error Occurred</Text>
                  <Text style={styles.subtitle}>Oroborous caught an unexpected exception.</Text>
                </View>
              </View>

              <View style={styles.divider} />

              <Text style={styles.sectionLabel}>ERROR DETAILS</Text>
              <View style={styles.codeContainer}>
                <Text style={styles.codeText}>
                  {this.state.error ? this.state.error.toString() : 'Unknown Error'}
                </Text>
                {this.state.errorInfo?.componentStack && (
                  <Text style={styles.stackText} numberOfLines={8}>
                    {this.state.errorInfo.componentStack.trim()}
                  </Text>
                )}
              </View>

              <Text style={styles.infoText}>
                You can send this error report directly to developer <Text style={styles.devText}>itswal</Text> at <Text style={styles.devText}>me@itswal.me</Text>.
              </Text>

              <View style={styles.buttonColumn}>
                <TouchableOpacity style={styles.emailButton} onPress={this.handleSendEmail} activeOpacity={0.8}>
                  <Ionicons name="mail-outline" size={20} color="#050B14" />
                  <Text style={styles.emailButtonText}>Send Error Report to Developer</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.resetButton} onPress={this.handleReset} activeOpacity={0.8}>
                  <Ionicons name="refresh-outline" size={20} color="#e2e8f0" />
                  <Text style={styles.resetButtonText}>Try Restarting App Screen</Text>
                </TouchableOpacity>
              </View>
            </GlassContainer>
          </ScrollView>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  scrollContent: {
    padding: 24,
    paddingTop: 60,
    alignItems: 'center',
  },
  card: {
    width: '100%',
    maxWidth: 440,
    padding: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    marginVertical: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ef4444',
    letterSpacing: 1,
    marginBottom: 8,
  },
  codeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    marginBottom: 16,
  },
  codeText: {
    color: '#f87171',
    fontFamily: 'monospace',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 6,
  },
  stackText: {
    color: '#94a3b8',
    fontFamily: 'monospace',
    fontSize: 11,
    lineHeight: 16,
  },
  infoText: {
    color: '#cbd5e1',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 24,
  },
  devText: {
    color: '#00e1ff',
    fontWeight: '700',
  },
  buttonColumn: {
    gap: 12,
  },
  emailButton: {
    backgroundColor: '#00e1ff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  emailButtonText: {
    color: '#050B14',
    fontWeight: '800',
    fontSize: 14,
  },
  resetButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  resetButtonText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
  },
});

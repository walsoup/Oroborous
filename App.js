import { StatusBar } from 'expo-status-bar';
import { SafeAreaView, StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.container}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Expo Native</Text>
        </View>
        <Text style={styles.title}>Oroborous</Text>
        <Text style={styles.subtitle}>Fresh mobile-first experience, powered by Expo.</Text>

        <View style={styles.card}>
          <Text style={styles.cardHeading}>Get started</Text>
          <Text style={styles.cardBody}>
            Run npm start to launch the Expo dev server, then scan the QR code in Expo Go or open the web
            preview in your browser.
          </Text>
          <Text style={styles.cardBody}>Update App.js to begin building new screens.</Text>
        </View>

        <Text style={styles.footer}>Built with React Native core components — no Tailwind required.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    gap: 16,
  },
  pill: {
    alignSelf: 'flex-start',
    backgroundColor: '#22d3ee',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  pillText: {
    color: '#0f172a',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 20,
    gap: 10,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  cardHeading: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  cardBody: {
    color: '#cbd5e1',
    fontSize: 15,
    lineHeight: 22,
  },
  footer: {
    color: '#94a3b8',
    fontSize: 13,
    marginTop: 'auto',
  },
});

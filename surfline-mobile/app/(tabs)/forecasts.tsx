import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function ForecastsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Previsión Marítima</Text>
        <Text style={styles.subtitle}>Física de olas y offline — Fase 3</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a1628' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { color: '#ffffff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: '#7a8fa6', fontSize: 14, marginTop: 8 },
});

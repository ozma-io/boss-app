import { ScrollView, StyleSheet, Text, View } from 'react-native';

// MOCKED DATA - temporary, will be replaced with real data later
const mockBoss = {
  name: 'Olga Ivanovna',
  position: 'CTO',
  company: 'TechCorp',
  startedAt: '2024-09-01',
  email: 'olga.ivanovna@techcorp.com',
  phone: '+7 (999) 123-45-67',
};

export default function BossScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Boss</Text>
        <Text style={styles.headerSubtitle}>Current workplace</Text>
      </View>
      
      <View style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.label}>Name</Text>
          <Text style={styles.value}>{mockBoss.name}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Position</Text>
          <Text style={styles.value}>{mockBoss.position}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Company</Text>
          <Text style={styles.value}>{mockBoss.company}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Started At</Text>
          <Text style={styles.value}>{mockBoss.startedAt}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{mockBoss.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.label}>Phone</Text>
          <Text style={styles.value}>{mockBoss.phone}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    paddingTop: 60,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});

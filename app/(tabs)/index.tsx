import { FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Mock data for testing
const mockBosses = [
  { id: '1', name: 'Olga Ivanovna', position: 'CTO', startedAt: '2024-09-01' },
  { id: '2', name: 'Sergey Petrov', position: 'CEO', startedAt: '2024-01-15' },
  { id: '3', name: 'Anna Sidorova', position: 'VP of Engineering', startedAt: '2023-06-10' },
];

export default function BossListScreen() {
  const renderBossCard = ({ item }: { item: typeof mockBosses[0] }) => (
    <TouchableOpacity style={styles.card}>
      <View style={styles.cardContent}>
        <Text style={styles.bossName}>{item.name}</Text>
        <Text style={styles.bossPosition}>{item.position}</Text>
        <Text style={styles.bossDate}>Started: {item.startedAt}</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Bosses</Text>
        <Text style={styles.headerSubtitle}>Track your relationships</Text>
      </View>
      
      <FlatList
        data={mockBosses}
        renderItem={renderBossCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No bosses yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add your first boss</Text>
          </View>
        }
      />
      
      <TouchableOpacity style={styles.addButton}>
        <Text style={styles.addButtonText}>+ Add Boss</Text>
      </TouchableOpacity>
    </View>
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
  listContent: {
    padding: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardContent: {
    padding: 16,
  },
  bossName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  bossPosition: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  bossDate: {
    fontSize: 14,
    color: '#999',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  content: { flex: 1, paddingTop: 12 },

  inputRow: { flexDirection: 'row' },
  input: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD',
  },
  addButton: {
    backgroundColor: '#007AFF',
    width: 55,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  addButtonText: { color: '#fff', fontSize: 30 },

  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  statusText: { color: '#666', fontSize: 12 },
  syncButton: { backgroundColor: '#111', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  syncButtonText: { color: '#fff', fontSize: 12, fontWeight: '600' },

  hint: { textAlign: 'center', color: '#999', marginTop: 10, fontSize: 12 },

  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  card: { flex: 1, backgroundColor: '#fff', padding: 18, borderRadius: 12, elevation: 2 },
  taskText: { fontSize: 16, color: '#333' },
  completedText: { textDecorationLine: 'line-through', color: '#BBB' },
  deleteBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },

  clearButton: { marginTop: 8, backgroundColor: '#34C759', padding: 14, borderRadius: 12, alignItems: 'center' },
  clearButtonText: { color: '#fff', fontWeight: '700' },
});

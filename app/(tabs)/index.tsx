import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTasks } from '../../context/TaskContext';

export default function HomeScreen() {
  const { visibleTasks, loading, syncing, isOnline, addTask, toggleTask, deleteTask, clearCompleted, syncNow } = useTasks();
  const [newTask, setNewTask] = useState('');

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  // shake => ryd færdige opgaver
  useEffect(() => {
    const sub = Accelerometer.addListener(data => {
      const total = Math.abs(data.x) + Math.abs(data.y) + Math.abs(data.z);
      if (total > 2.5) {
        const hasCompleted = visibleTasks.some(t => t.is_completed);
        if (hasCompleted) {
          Alert.alert('Rystelse registreret', 'Vil du slette alle færdige opgaver?', [
            { text: 'Annuller', style: 'cancel' },
            { text: 'Slet', style: 'destructive', onPress: clearCompleted },
          ]);
        }
      }
    });
    Accelerometer.setUpdateInterval(400);
    return () => sub.remove();
  }, [clearCompleted, visibleTasks]);

  const onAdd = () => {
    addTask(newTask);
    setNewTask('');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, { paddingHorizontal: isLandscape ? 80 : 20 }]}>
        <FlatList
          data={visibleTasks}
          keyExtractor={item => item.localId}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncNow} />}
          ListHeaderComponent={
            <View style={{ marginBottom: 12 }}>
              <View style={styles.inputRow}>
                <TextInput
                  style={[styles.input, { color: 'black' }]}
                  placeholder="Skriv ny opgave..."
                  placeholderTextColor="black"
                  value={newTask}
                  onChangeText={setNewTask}
                  onSubmitEditing={onAdd}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addButton} onPress={onAdd}>
                  <Text style={styles.addButtonText}>+</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.statusRow}>
                <Text style={styles.statusText}>
                  {isOnline ? '🟢 Online' : '🔴 Offline'} • {syncing ? 'Synkroniserer…' : 'Klar'}
                </Text>
                <TouchableOpacity style={styles.syncButton} onPress={syncNow} disabled={!isOnline || syncing}>
                  <Text style={styles.syncButtonText}>Synk</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.hint}>📳 Ryst telefonen for at rydde færdige opgaver</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.cardRow}>
              <TouchableOpacity style={styles.card} onPress={() => toggleTask(item.localId)}>
                <Text style={[styles.taskText, item.is_completed && styles.completedText]}>
                  {item.is_completed ? '☑️ ' : '⬜ '} {item.title}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.deleteBtn} onPress={() => deleteTask(item.localId)}>
                <Text style={{ fontSize: 16 }}>🗑️</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={{ paddingTop: 30 }}>
              <Text style={{ textAlign: 'center', color: '#888' }}>Ingen opgaver endnu – tilføj en øverst 👆</Text>
            </View>
          }
        />

        <TouchableOpacity style={styles.clearButton} onPress={clearCompleted}>
          <Text style={styles.clearButtonText}>Ryd færdige opgaver</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

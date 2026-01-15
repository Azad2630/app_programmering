import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTasks } from '../../context/TaskContext';

export default function SyncScreen() {
  const { tasks, isOnline, syncing, lastSync, syncNow } = useTasks();

  const pendingCount = useMemo(() => {
    return tasks.filter(t => (!t.synced && !t.deleted) || t.deleted).length;
  }, [tasks]);

  const totalVisible = useMemo(() => tasks.filter(t => !t.deleted).length, [tasks]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.title}>Synkronisering</Text>

        <Text style={styles.row}>Status: {isOnline ? '🟢 Online' : '🔴 Offline'}</Text>
        <Text style={styles.row}>Sidste sync: {lastSync ? new Date(lastSync).toLocaleString() : '—'}</Text>
        <Text style={styles.row}>Opgaver lokalt: {totalVisible}</Text>
        <Text style={styles.row}>Afventer sync: {pendingCount}</Text>

        <TouchableOpacity style={styles.button} onPress={syncNow} disabled={!isOnline || syncing}>
          <Text style={styles.buttonText}>{syncing ? 'Synkroniserer…' : 'Synk nu'}</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Appen gemmer altid opgaver lokalt først og forsøger derefter at synkronisere med cloud via web API (Supabase).
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA', padding: 20, justifyContent: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 18, elevation: 2 },
  title: { fontSize: 20, fontWeight: '800', marginBottom: 12 },
  row: { fontSize: 14, color: '#333', marginBottom: 6 },
  button: { marginTop: 14, backgroundColor: '#007AFF', padding: 14, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  note: { marginTop: 14, fontSize: 12, color: '#666', lineHeight: 18 },
});

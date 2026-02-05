import React, { useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles } from '../../components/ui/styles/tabs/sync.styles';
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

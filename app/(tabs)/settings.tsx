import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTasks } from '../../context/TaskContext';
import { loadMeta, resetAllLocalData, saveMeta } from '../../lib/taskStorage';

export default function SettingsScreen() {
  const { autoSync, setAutoSync, cloudSyncEnabled, setCloudSyncEnabled } = useTasks();
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      const meta = await loadMeta();
      if (meta.userName) setName(meta.userName);
      else {
        const old = await AsyncStorage.getItem('user_name'); // hvis du havde den gamle nøgle
        if (old) setName(old);
      }
    })();
  }, []);

  const save = async () => {
    await AsyncStorage.setItem('user_name', name);
    const meta = await loadMeta();
    await saveMeta({
      ...meta,
      userName: name,
      autoSync,
      cloudSyncEnabled,
    });
    Alert.alert('Gemt', 'Profil gemt lokalt!');
  };

  const reset = async () => {
    Alert.alert('Nulstil', 'Vil du slette alle lokale data (opgaver + meta)?', [
      { text: 'Annuller', style: 'cancel' },
      {
        text: 'Slet',
        style: 'destructive',
        onPress: async () => {
          await resetAllLocalData();
          Alert.alert('OK', 'Lokale data er slettet. Genstart appen for helt ren start.');
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profil & Indstillinger</Text>

      <Text style={styles.label}>Navn (lokalt gemt):</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Dit navn…" />

      <TouchableOpacity style={styles.button} onPress={save}>
        <Text style={styles.buttonText}>Gem lokalt</Text>
      </TouchableOpacity>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Cloud-sync:</Text>
        <Switch value={cloudSyncEnabled} onValueChange={setCloudSyncEnabled} />
      </View>

      <Text style={styles.note}>
        Når cloud-sync er slået fra, gemmes opgaver kun lokalt og appen henter/overskriver ikke fra Supabase.
      </Text>

      <View style={styles.switchRow}>
        <Text style={styles.label}>Auto-sync (når online):</Text>
        <Switch value={autoSync} onValueChange={setAutoSync} disabled={!cloudSyncEnabled} />
      </View>

      <Text style={styles.note}>
        Auto-sync er deaktiveret hvis cloud-sync er slået fra.
      </Text>

      <TouchableOpacity style={[styles.button, { backgroundColor: '#111' }]} onPress={reset}>
        <Text style={styles.buttonText}>Nulstil lokale data</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 10, marginBottom: 14 },
  button: { backgroundColor: '#34C759', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 14 },
  buttonText: { color: '#fff', fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  note: { marginBottom: 14, fontSize: 12, color: '#666', lineHeight: 18 },
});

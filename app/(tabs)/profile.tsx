import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from './screen-styles/profile-screen.styles';
import { useTasks } from '../../context/task-context';
import { loadMeta, saveMeta } from '../../lib/task-storage';

export default function ProfileScreen() {
  const { tasks, autoSync, setAutoSync, cloudSyncEnabled, setCloudSyncEnabled, resetLocalData } = useTasks();
  const [name, setName] = useState('');

  useEffect(() => {
    (async () => {
      const meta = await loadMeta();
      if (meta.userName) {
        setName(meta.userName);
        return;
      }

      const legacyName = await AsyncStorage.getItem('user_name');
      if (legacyName) setName(legacyName);
    })();
  }, []);

  const visibleCount = useMemo(() => tasks.filter(task => !task.deleted).length, [tasks]);
  const pendingCount = useMemo(() => tasks.filter(task => (!task.synced && !task.deleted) || task.deleted).length, [tasks]);

  const save = async () => {
    await AsyncStorage.setItem('user_name', name);
    const meta = await loadMeta();
    await saveMeta({
      ...meta,
      userName: name,
      autoSync,
      cloudSyncEnabled,
    });
    Alert.alert('Saved', 'Profile saved locally.');
  };

  const reset = () => {
    Alert.alert('Reset Local Data', 'Do you want to remove all local tasks and metadata?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await resetLocalData();
          setName('');
          Alert.alert('Done', 'Local data has been removed.');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <Animated.View entering={FadeInDown.duration(380)} style={styles.titleRow}>
          <Ionicons name="person-circle-outline" size={28} color="#0F766E" />
          <Text style={styles.title}>Profile & Preferences</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(70).duration(380)} style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="id-card-outline" size={18} color="#2563EB" />
            <Text style={styles.sectionTitle}>Profile</Text>
          </View>
          <Text style={styles.label}>Display name</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name..." />
          <Pressable style={styles.button} onPress={save}>
            <Ionicons name="save-outline" size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Save Profile</Text>
          </Pressable>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(130).duration(380)} style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="cloud-outline" size={18} color="#2563EB" />
            <Text style={styles.sectionTitle}>Sync Settings</Text>
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Ionicons name="cloud-upload-outline" size={16} color="#475569" />
              <Text style={styles.labelInline}>Cloud sync</Text>
            </View>
            <Switch value={cloudSyncEnabled} onValueChange={setCloudSyncEnabled} />
          </View>
          <View style={styles.switchRow}>
            <View style={styles.switchLabelWrap}>
              <Ionicons name="sync-outline" size={16} color="#475569" />
              <Text style={styles.labelInline}>Auto sync (when online)</Text>
            </View>
            <Switch value={autoSync} onValueChange={setAutoSync} disabled={!cloudSyncEnabled} />
          </View>
          <Text style={styles.note}>When cloud sync is off, all changes stay on this device only.</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(190).duration(380)} style={styles.card}>
          <View style={styles.cardTitleRow}>
            <Ionicons name="server-outline" size={18} color="#2563EB" />
            <Text style={styles.sectionTitle}>Local Data</Text>
          </View>
          <Text style={styles.meta}>Local tasks: {visibleCount}</Text>
          <Text style={styles.meta}>Pending sync: {pendingCount}</Text>
          <Pressable style={[styles.button, styles.dangerButton]} onPress={reset}>
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.buttonText}>Reset Local Data</Text>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

import { Ionicons } from '@expo/vector-icons';
import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from './screen-styles/sync-screen.styles';
import { AnimatedPressable } from './ui/animated-pressable';
import { useTasks } from '../../context/task-context';

function cloudStatusLabel(status: 'unknown' | 'connected' | 'unavailable' | 'disabled') {
  if (status === 'connected') return 'Available';
  if (status === 'unavailable') return 'Unavailable';
  if (status === 'disabled') return 'Disabled';
  return 'Checking';
}

export default function SyncStatusScreen() {
  const { tasks, isOnline, cloudStatus, lastSyncError, syncing, lastSync, syncNow } = useTasks();

  const stats = useMemo(() => {
    const localVisible = tasks.filter(task => !task.deleted).length;
    const pending = tasks.filter(task => (!task.synced && !task.deleted) || task.deleted).length;
    const syncedVisible = tasks.filter(task => !task.deleted && task.synced).length;
    return { localVisible, pending, syncedVisible };
  }, [tasks]);

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View entering={FadeInDown.duration(420)} style={styles.card}>
        <View style={styles.titleRow}>
          <Ionicons name="cloud-done-outline" size={22} color="#0F766E" />
          <Text style={styles.title}>Sync Status</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="wifi-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Internet</Text>
          </View>
          <Text style={[styles.value, !isOnline && styles.valueError]}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="cloud-upload-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Cloud (Supabase)</Text>
          </View>
          <Text style={[styles.value, cloudStatus === 'unavailable' && styles.valueError]}>{cloudStatusLabel(cloudStatus)}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="time-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Last successful sync</Text>
          </View>
          <Text style={styles.value}>{lastSync ? new Date(lastSync).toLocaleString() : 'Not synced yet'}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="file-tray-stacked-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Local tasks</Text>
          </View>
          <Text style={styles.value}>{stats.localVisible}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="hourglass-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Pending sync</Text>
          </View>
          <Text style={styles.value}>{stats.pending}</Text>
        </View>

        <View style={styles.row}>
          <View style={styles.rowLabelWrap}>
            <Ionicons name="checkmark-done-outline" size={16} color="#64748B" />
            <Text style={styles.label}>Synced locally</Text>
          </View>
          <Text style={styles.value}>{stats.syncedVisible}</Text>
        </View>

        <AnimatedPressable style={styles.button} onPress={syncNow} disabled={!isOnline || syncing}>
          <Ionicons name="sync-outline" size={16} color="#FFFFFF" />
          <Text style={styles.buttonText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
        </AnimatedPressable>

        {lastSyncError ? <Text style={styles.errorText}>Last error: {lastSyncError}</Text> : null}

        <Text style={styles.note}>This app always saves locally first, then syncs with Supabase when possible.</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

import { Ionicons } from '@expo/vector-icons';
import { Accelerometer } from 'expo-sensors';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, RefreshControl, Text, TextInput, TouchableOpacity, useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, Layout } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from './screen-styles/tasks-screen.styles';
import { AnimatedPressable } from './ui/animated-pressable';
import { useTasks } from '../../context/task-context';
import type { LocalTask, TaskPriority } from '../../lib/task-types';

type Filter = 'all' | 'active' | 'done';

function isValidDate(value: string) {
  if (!value.trim()) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00`);
  return !Number.isNaN(date.getTime());
}

function isOverdue(task: LocalTask) {
  if (!task.due_at || task.is_completed) return false;
  const due = new Date(`${task.due_at}T23:59:59`);
  return due.getTime() < Date.now();
}

function cloudLabel(status: 'unknown' | 'connected' | 'unavailable' | 'disabled') {
  if (status === 'connected') return 'Cloud Ready';
  if (status === 'disabled') return 'Cloud Disabled';
  if (status === 'unavailable') return 'Cloud Unavailable';
  return 'Cloud Checking';
}

function priorityLabel(priority: TaskPriority) {
  if (priority === 'high') return 'High';
  if (priority === 'medium') return 'Medium';
  return 'Low';
}

export default function TasksScreen() {
  const { tasks, visibleTasks, loading, syncing, isOnline, cloudStatus, addTask, updateTask, toggleTask, deleteTask, restoreTask, clearCompleted, syncNow } =
    useTasks();

  const [titleInput, setTitleInput] = useState('');
  const [dueDateInput, setDueDateInput] = useState('');
  const [priorityInput, setPriorityInput] = useState<TaskPriority>('medium');
  const [searchText, setSearchText] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [undoTask, setUndoTask] = useState<{ localId: string; title: string } | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const sub = Accelerometer.addListener(data => {
      if (Math.abs(data.x) <= 1.2) return;
      const hasCompleted = visibleTasks.some(task => task.is_completed);
      if (!hasCompleted) return;

      Alert.alert('Shake Detected', 'Clear all completed tasks?', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearCompleted },
      ]);
    });

    Accelerometer.setUpdateInterval(300);
    return () => sub.remove();
  }, [clearCompleted, visibleTasks]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const counts = useMemo(() => {
    const total = visibleTasks.length;
    const completed = visibleTasks.filter(task => task.is_completed).length;
    const active = total - completed;
    const pendingSync = tasks.filter(task => (!task.synced && !task.deleted) || task.deleted).length;
    const overdue = visibleTasks.filter(task => isOverdue(task)).length;
    return { total, completed, active, pendingSync, overdue };
  }, [tasks, visibleTasks]);

  const filteredTasks = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    return visibleTasks.filter(task => {
      if (filter === 'active' && task.is_completed) return false;
      if (filter === 'done' && !task.is_completed) return false;
      if (query && !task.title.toLowerCase().includes(query)) return false;
      return true;
    });
  }, [visibleTasks, filter, searchText]);

  const resetEditor = () => {
    setEditingTaskId(null);
    setTitleInput('');
    setDueDateInput('');
    setPriorityInput('medium');
  };

  const startEdit = (task: LocalTask) => {
    setEditingTaskId(task.localId);
    setTitleInput(task.title);
    setDueDateInput(task.due_at ?? '');
    setPriorityInput(task.priority);
  };

  const submitTask = () => {
    const title = titleInput.trim();
    if (!title) return;

    if (!isValidDate(dueDateInput)) {
      Alert.alert('Invalid Date', 'Use YYYY-MM-DD format, for example 2026-02-20.');
      return;
    }

    const dueAt = dueDateInput.trim() ? dueDateInput.trim() : null;
    if (editingTaskId) {
      updateTask(editingTaskId, { title, priority: priorityInput, dueAt });
      resetEditor();
      return;
    }

    addTask(title, { priority: priorityInput, dueAt });
    setTitleInput('');
    setDueDateInput('');
    setPriorityInput('medium');
  };

  const onDelete = (task: LocalTask) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    deleteTask(task.localId);
    setUndoTask({ localId: task.localId, title: task.title });
    undoTimerRef.current = setTimeout(() => {
      setUndoTask(null);
      undoTimerRef.current = null;
    }, 4500);
  };

  const onUndoDelete = () => {
    if (!undoTask) return;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    restoreTask(undoTask.localId);
    setUndoTask(null);
    undoTimerRef.current = null;
  };

  const renderTaskItem = ({ item, index }: { item: LocalTask; index: number }) => (
    <Animated.View
      entering={FadeInUp.delay(Math.min(index, 10) * 26).duration(260)}
      layout={Layout.springify().damping(18).stiffness(210)}
      style={styles.taskRow}
    >
      <TouchableOpacity style={styles.taskCard} onPress={() => toggleTask(item.localId)} activeOpacity={0.9}>
        <View style={styles.taskHeader}>
          <Ionicons
            name={item.is_completed ? 'checkmark-circle' : 'ellipse-outline'}
            size={22}
            color={item.is_completed ? '#16A34A' : '#2563EB'}
          />
          <Text style={[styles.taskText, item.is_completed && styles.completedText]}>{item.title}</Text>
        </View>
        <View style={styles.metaRow}>
          <View style={[styles.priorityPill, item.priority === 'high' && styles.priorityHigh, item.priority === 'medium' && styles.priorityMedium]}>
            <Ionicons name="flag-outline" size={12} color="#FFFFFF" />
            <Text style={styles.priorityPillText}>{priorityLabel(item.priority)}</Text>
          </View>
          <View style={[styles.duePill, isOverdue(item) && styles.duePillOverdue]}>
            <Ionicons name="calendar-outline" size={12} color={isOverdue(item) ? '#FFFFFF' : '#475569'} />
            <Text style={[styles.deadlineText, isOverdue(item) && styles.deadlineOverdue]}>
              {item.due_at ? item.due_at : 'No due date'}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionColumn}>
        <AnimatedPressable style={[styles.iconActionBtn, styles.editBtn]} onPress={() => startEdit(item)}>
          <Ionicons name="create-outline" size={16} color="#FFFFFF" />
        </AnimatedPressable>
        <AnimatedPressable style={[styles.iconActionBtn, styles.deleteBtn]} onPress={() => onDelete(item)}>
          <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
        </AnimatedPressable>
      </View>
    </Animated.View>
  );

  const header = (
    <Animated.View entering={FadeInDown.duration(420)} style={styles.headerWrap}>
      <View style={styles.titleRow}>
        <Ionicons name="sparkles-outline" size={22} color="#0F766E" />
        <Text style={styles.title}>Task Board</Text>
      </View>

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder={editingTaskId ? 'Edit task title...' : 'Write a new task...'}
          placeholderTextColor="#64748B"
          value={titleInput}
          onChangeText={setTitleInput}
          onSubmitEditing={submitTask}
          returnKeyType="done"
        />
        <AnimatedPressable style={styles.addButton} onPress={submitTask}>
          <Ionicons name={editingTaskId ? 'save-outline' : 'add'} size={18} color="#FFFFFF" />
          <Text style={styles.addButtonText}>{editingTaskId ? 'Save' : 'Add'}</Text>
        </AnimatedPressable>
      </View>

      <View style={styles.detailRow}>
        <View style={styles.dateInputWrap}>
          <Ionicons name="calendar-clear-outline" size={16} color="#64748B" />
          <TextInput
            style={styles.dateInput}
            placeholder="Due date YYYY-MM-DD"
            placeholderTextColor="#64748B"
            value={dueDateInput}
            onChangeText={setDueDateInput}
          />
        </View>
        <View style={styles.priorityRow}>
          <TouchableOpacity style={[styles.priorityChip, styles.priorityLow, priorityInput === 'low' && styles.priorityChipActive]} onPress={() => setPriorityInput('low')}>
            <Text style={styles.priorityChipText}>Low</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.priorityChip, styles.priorityMid, priorityInput === 'medium' && styles.priorityChipActive]}
            onPress={() => setPriorityInput('medium')}
          >
            <Text style={styles.priorityChipText}>Medium</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.priorityChip, styles.priorityHi, priorityInput === 'high' && styles.priorityChipActive]} onPress={() => setPriorityInput('high')}>
            <Text style={styles.priorityChipText}>High</Text>
          </TouchableOpacity>
        </View>
      </View>

      {editingTaskId ? (
        <TouchableOpacity style={styles.cancelEditButton} onPress={resetEditor}>
          <Ionicons name="close-circle-outline" size={15} color="#B91C1C" />
          <Text style={styles.cancelEditButtonText}>Cancel editing</Text>
        </TouchableOpacity>
      ) : null}

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#64748B" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks..."
          placeholderTextColor="#64748B"
          value={searchText}
          onChangeText={setSearchText}
        />
      </View>

      <View style={styles.filterRow}>
        <TouchableOpacity style={[styles.filterChip, filter === 'all' && styles.filterChipActive]} onPress={() => setFilter('all')}>
          <Text style={[styles.filterChipText, filter === 'all' && styles.filterChipTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, filter === 'active' && styles.filterChipActive]} onPress={() => setFilter('active')}>
          <Text style={[styles.filterChipText, filter === 'active' && styles.filterChipTextActive]}>Active</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.filterChip, filter === 'done' && styles.filterChipActive]} onPress={() => setFilter('done')}>
          <Text style={[styles.filterChipText, filter === 'done' && styles.filterChipTextActive]}>Completed</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.completed}</Text>
          <Text style={styles.statLabel}>Completed</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.overdue}</Text>
          <Text style={styles.statLabel}>Overdue</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{counts.pendingSync}</Text>
          <Text style={styles.statLabel}>Pending Sync</Text>
        </View>
      </View>

      <View style={styles.statusRow}>
        <View style={styles.statusPills}>
          <View style={[styles.statusPill, isOnline ? styles.statusPillOnline : styles.statusPillOffline]}>
            <Ionicons name={isOnline ? 'wifi-outline' : 'wifi'} size={13} color={isOnline ? '#065F46' : '#B91C1C'} />
            <Text style={[styles.statusPillText, isOnline ? styles.statusPillTextOnline : styles.statusPillTextOffline]}>
              {isOnline ? 'Network Online' : 'Network Offline'}
            </Text>
          </View>
          <View style={[styles.statusPill, cloudStatus === 'connected' ? styles.statusPillOnline : styles.statusPillWarning]}>
            <Ionicons
              name={cloudStatus === 'connected' ? 'cloud-done-outline' : 'cloud-offline-outline'}
              size={13}
              color={cloudStatus === 'connected' ? '#065F46' : '#9A3412'}
            />
            <Text style={[styles.statusPillText, cloudStatus === 'connected' ? styles.statusPillTextOnline : styles.statusPillTextWarning]}>
              {cloudLabel(cloudStatus)}
            </Text>
          </View>
        </View>
        <AnimatedPressable style={styles.syncButton} onPress={syncNow} disabled={!isOnline || syncing}>
          <Ionicons name="sync-outline" size={14} color="#FFFFFF" />
          <Text style={styles.syncButtonText}>{syncing ? 'Syncing...' : 'Sync Now'}</Text>
        </AnimatedPressable>
      </View>

      <Text style={styles.hint}>Tip: shake your phone to clear completed tasks quickly.</Text>
    </Animated.View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color="#0F766E" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.content, { paddingHorizontal: isLandscape ? 72 : 18 }]}>
        <FlatList
          style={styles.list}
          data={filteredTasks}
          keyExtractor={item => item.localId}
          renderItem={renderTaskItem}
          refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncNow} />}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="file-tray-outline" size={26} color="#64748B" />
              <Text style={styles.emptyText}>No tasks match your current filter.</Text>
            </View>
          }
          contentContainerStyle={styles.listContent}
        />

        <AnimatedPressable style={styles.clearButton} onPress={clearCompleted}>
          <Ionicons name="checkmark-done-outline" size={16} color="#FFFFFF" />
          <Text style={styles.clearButtonText}>Clear Completed</Text>
        </AnimatedPressable>

        {undoTask ? (
          <Animated.View entering={FadeInUp.duration(220)} style={styles.undoBar}>
            <Ionicons name="trash-outline" size={16} color="#FFFFFF" />
            <Text style={styles.undoText}>Deleted: {undoTask.title}</Text>
            <AnimatedPressable style={styles.undoBtn} onPress={onUndoDelete}>
              <Text style={styles.undoBtnText}>Undo</Text>
            </AnimatedPressable>
          </Animated.View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

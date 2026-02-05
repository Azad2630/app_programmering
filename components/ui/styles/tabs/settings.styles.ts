import { StyleSheet } from 'react-native';

export const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#fff' },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8, color: '#333' },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 12, borderRadius: 10, marginBottom: 14 },
  button: { backgroundColor: '#34C759', padding: 14, borderRadius: 12, alignItems: 'center', marginBottom: 14 },
  buttonText: { color: '#fff', fontWeight: '800' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  note: { marginBottom: 14, fontSize: 12, color: '#666', lineHeight: 18 },
});

import { StyleSheet } from 'react-native';

import { AppTheme } from './app-theme';

const c = AppTheme.colors;
const r = AppTheme.radius;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background, padding: 20, justifyContent: 'center' },
  card: { backgroundColor: c.surface, borderRadius: r.lg, padding: 18, borderWidth: 1, borderColor: c.border },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 23, fontWeight: '800', color: c.text },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 9,
    paddingBottom: 9,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
  },
  rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, maxWidth: '56%' },
  label: { fontSize: 13, color: c.textSoft, fontWeight: '600' },
  value: { fontSize: 14, color: c.text, fontWeight: '700', maxWidth: '42%', textAlign: 'right' },
  valueError: { color: c.danger },
  button: {
    marginTop: 16,
    backgroundColor: c.primary,
    paddingVertical: 12,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },
  errorText: { marginTop: 12, fontSize: 12, color: c.danger, lineHeight: 17 },
  note: { marginTop: 12, fontSize: 12, color: c.textSoft, lineHeight: 18 },
});

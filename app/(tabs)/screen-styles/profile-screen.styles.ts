import { StyleSheet } from 'react-native';

import { AppTheme } from './app-theme';

const c = AppTheme.colors;
const r = AppTheme.radius;

export const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: c.background },
  scrollContent: { padding: 20, paddingBottom: 28 },

  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  title: { fontSize: 25, fontWeight: '800', color: c.text, flex: 1 },

  card: {
    backgroundColor: c.surface,
    borderRadius: r.lg,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: c.border,
  },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 10 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: c.text },

  label: { fontSize: 13, marginBottom: 8, color: c.textMuted, fontWeight: '600' },
  labelInline: { fontSize: 14, color: c.textMuted, fontWeight: '600' },
  switchLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1, paddingRight: 10 },
  input: {
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderRadius: r.sm,
    marginBottom: 12,
    color: c.text,
  },
  button: {
    backgroundColor: c.primary,
    paddingVertical: 12,
    borderRadius: r.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
    flexDirection: 'row',
    gap: 6,
  },
  dangerButton: { backgroundColor: c.danger },
  buttonText: { color: '#FFFFFF', fontWeight: '700' },

  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    paddingVertical: 4,
  },
  note: { marginTop: 4, fontSize: 12, color: c.textSoft, lineHeight: 18 },
  meta: { fontSize: 14, color: c.textMuted, marginBottom: 7, fontWeight: '600' },
});

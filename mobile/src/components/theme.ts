import { Platform, StyleSheet } from 'react-native';
export const colors = { background: '#F6F5F0', surface: '#FFFFFF', ink: '#233A37', muted: '#667570', accent: '#355E52', tint: '#E6EDE5', line: '#DCE2DA', gold: '#E4B66F', card: '#EBEDE5', error: '#934A33' };
export const serif = Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' });
export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 32, gap: 24, width: '100%', maxWidth: 600, alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  spread: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  eyebrow: { color: colors.muted, fontSize: 11, fontWeight: '700', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontFamily: serif, fontSize: 35, color: colors.ink, letterSpacing: -.8, lineHeight: 41 },
  heading: { fontFamily: serif, fontSize: 26, color: colors.ink, letterSpacing: -.5 },
  text: { fontSize: 15, lineHeight: 22, color: colors.ink },
  muted: { fontSize: 13, lineHeight: 19, color: colors.muted },
  card: { backgroundColor: colors.surface, borderRadius: 22, padding: 20, gap: 12, borderColor: colors.line, borderWidth: 1 },
  button: { minHeight: 48, paddingHorizontal: 20, paddingVertical: 13, borderRadius: 14, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  buttonText: { color: 'white', fontWeight: '600', fontSize: 14 },
  secondary: { backgroundColor: colors.tint },
  secondaryText: { color: colors.ink },
  iconButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  input: { minHeight: 52, borderWidth: 1, borderColor: colors.line, borderRadius: 14, backgroundColor: 'white', color: colors.ink, paddingHorizontal: 15, fontSize: 16 },
  notice: { borderRadius: 14, backgroundColor: '#F0E6D5', padding: 14, gap: 7 },
  divider: { height: 1, backgroundColor: colors.line },
});

import { AppIcon } from './AppIcon';
import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, ui } from './theme';
import { isSampleMode } from '../lib/api';
import { useAppState } from '../state/AppState';
export function Screen({ children, ...props }: ScrollViewProps) {
  return <SafeAreaView edges={['top','left','right']} style={ui.screen}><ScrollView {...props} contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">{children}</ScrollView></SafeAreaView>;
}
export function Button({ label, onPress, secondary, disabled, loading, icon }: { label: string; onPress: () => void; secondary?: boolean; disabled?: boolean; loading?: boolean; icon?: React.ComponentProps<typeof AppIcon>['name'] }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled || !!loading, busy: !!loading }} onPress={onPress} disabled={disabled || loading}
    style={({ pressed }) => [ui.button, secondary && ui.secondary, { opacity: disabled ? .55 : pressed ? .75 : 1 }]}>
    {loading ? <ActivityIndicator size="small" color={secondary ? colors.ink : 'white'} /> : icon ? <AppIcon name={icon} size={18} color={secondary ? colors.ink : 'white'} /> : null}
    <Text style={[ui.buttonText, secondary && ui.secondaryText, { flexShrink: 1, textAlign: 'center' }]}>{label}</Text>
  </Pressable>;
}
export function ModeNotice() {
  const { storageWarning } = useAppState();
  return <>
    {isSampleMode && <View style={[ui.notice, { flexDirection: 'row', alignItems: 'center', gap: 10 }]}><AppIcon name="flask-outline" size={17} color={colors.ink} /><Text style={[ui.muted, { flex: 1, color: colors.ink }]}>Sample preview · Illustrative weather, not live conditions</Text></View>}
    {!!storageWarning && <View style={ui.notice}><Text accessibilityRole="alert" style={ui.muted}>{storageWarning}</Text></View>}
  </>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: React.ReactNode }) {
  return <View style={[ui.card, { paddingVertical: 38, alignItems: 'center' }]}><AppIcon name="partly-sunny-outline" size={45} color={colors.accent} /><Text style={[ui.heading, { textAlign: 'center' }]}>{title}</Text><Text style={[ui.muted, { textAlign: 'center', maxWidth: 300 }]}>{description}</Text>{action}</View>;
}

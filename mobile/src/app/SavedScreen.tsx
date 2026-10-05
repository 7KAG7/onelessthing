import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button, EmptyState, Screen } from '../components/Primitives';
import { OutfitBoard } from '../components/OutfitBoard';
import { colors, ui } from '../components/theme';
import { temperature, weatherText } from '../lib/format';
import { useAppState } from '../state/AppState';
export default function Saved() {
  const navigation = useAppNavigation();
  const { saved, removeSaved, preferences, storageWarning } = useAppState();
  const [expanded, setExpanded] = useState<string | null>(null);
  return <Screen>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>THE GOOD ONES, KEPT</Text><Text style={ui.title}>Your everyday edits.</Text><Text style={ui.muted}>Saved on this device. A little inspiration for another day.</Text></View>
    {storageWarning && <View style={ui.notice}><Text accessibilityRole="alert" style={ui.muted}>{storageWarning}</Text></View>}
    {!saved.length ? <EmptyState title="Find a look you like." description="Save an outfit from Today and it will be here when you need it. Up to 30 recent outfits stay on this device." action={<Button label="Back to Today" onPress={() => navigation.navigate('Main', { screen: 'Today' })} />} /> : saved.map(item => <View key={item.id} style={ui.card}>
      <View style={ui.spread}><Text style={ui.eyebrow}>{item.data.location.name} · {temperature(item.data.weather.temperatureF, preferences.unit)}</Text><AppIcon name="bookmark" color={colors.accent} size={19} /></View>
      <Text style={ui.heading}>{item.data.outfit.title}</Text>
      <Text style={ui.muted}>{new Date(item.savedAt).toLocaleDateString()} · {item.sample ? 'Sample outfit' : 'Historical outfit'} · {item.data.outfit.pieces.length} pieces</Text>
      <Text style={ui.muted}>{weatherText(item.data.outfit.summary, preferences.unit)}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: expanded === item.id }} onPress={() => setExpanded(expanded === item.id ? null : item.id)} style={[ui.spread, { minHeight: 44 }]}><Text style={{ fontSize: 14, fontWeight: '600', color: colors.accent }}>{expanded === item.id ? 'Close outfit' : 'View outfit'}</Text><AppIcon name={expanded === item.id ? 'chevron-up' : 'chevron-down'} color={colors.accent} size={17} /></Pressable>
      {expanded === item.id && <><OutfitBoard data={item.data} unit={preferences.unit} compact /><Button label="Remove from saved" secondary onPress={() => { removeSaved(item.id); setExpanded(null); }} /></>}
    </View>)}
  </Screen>;
}

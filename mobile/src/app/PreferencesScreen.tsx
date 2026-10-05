import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { Pressable, Text, View } from 'react-native';
import { Button, ModeNotice, Screen } from '../components/Primitives';
import { colors, ui } from '../components/theme';
import { useAppState } from '../state/AppState';
function Choice<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (value: T) => void }) {
  return <View style={{ flexDirection: 'row', gap: 7, flexWrap: 'wrap' }}>{options.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => onChange(option.value)} style={({ pressed }) => ({ paddingHorizontal: 15, paddingVertical: 13, minHeight: 48, borderRadius: 13, borderWidth: 1, borderColor: value === option.value ? colors.accent : colors.line, backgroundColor: value === option.value ? colors.accent : 'white', opacity: pressed ? .7 : 1 })}><Text style={{ color: value === option.value ? 'white' : colors.ink, fontWeight: '500', fontSize: 13 }}>{option.label}</Text></Pressable>)}</View>;
}
export default function Preferences() {
  const navigation = useAppNavigation();
  const { preferences, setPreferences } = useAppState();
  return <Screen>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>A FEW PERSONAL TOUCHES</Text><Text style={ui.title}>Make it yours.</Text><Text style={ui.muted}>Little preferences. More comfortable days.</Text></View>
    <ModeNotice />
    <View style={ui.card}><Text style={ui.heading}>Your comfort</Text><Text style={ui.muted}>Adjust the layers we suggest. If you often feel cold, choose warmer.</Text><Choice value={preferences.comfort} onChange={comfort => setPreferences({ comfort })} options={[{ value: 'cooler', label: 'Lighter layers' }, { value: 'neutral', label: 'Just right' }, { value: 'warmer', label: 'Warmer layers' }]} /></View>
    <View style={ui.card}><Text style={ui.heading}>Clothing selection</Text><Text style={ui.muted}>Used only to shape shopping searches. Choose whatever works for you.</Text><Choice value={preferences.style} onChange={style => setPreferences({ style })} options={[{ value: 'unisex', label: 'Unisex' }, { value: 'female', label: 'Womenswear' }, { value: 'male', label: 'Menswear' }]} /></View>
    <View style={ui.card}><Text style={ui.heading}>Weather units</Text><Choice value={preferences.unit} onChange={unit => setPreferences({ unit })} options={[{ value: 'F', label: 'Fahrenheit · mph' }, { value: 'C', label: 'Celsius · km/h' }]} /></View>
    <View style={ui.card}><Text style={ui.heading}>Your place</Text><Text style={ui.muted}>{preferences.city || 'Choose a city to start your day'}</Text><Button secondary label="Change city" icon="location-outline" onPress={() => navigation.navigate('Location')} /></View>
    <View style={{ gap: 12 }}><View style={ui.row}><AppIcon name="shield-checkmark-outline" color={colors.accent} size={21} /><Text style={[ui.text, { fontWeight: '600' }]}>Simple by design</Text></View><Text style={ui.muted}>No account is needed. Preferences and saved outfits stay on this device. We only request your location when you choose to use it.</Text><Button secondary label="Privacy & how it works" onPress={() => navigation.navigate('Privacy')} /></View>
  </Screen>;
}

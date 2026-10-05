import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from 'react-native';
import { Button, EmptyState, ModeNotice, Screen } from '../components/Primitives';
import { OutfitBoard } from '../components/OutfitBoard';
import { ForecastStrip, WeatherPanel } from '../components/WeatherPanel';
import { colors, ui } from '../components/theme';
import { weatherText } from '../lib/format';
import { isSampleMode } from '../lib/api';
import { useAppState } from '../state/AppState';
export default function Today() {
  const navigation = useAppNavigation();
  const { ready, data, preferences, loading, error, load, saveCurrent, currentSaved, stale } = useAppState();
  return <Screen refreshControl={<RefreshControl refreshing={loading && !!data} onRefresh={() => { void load(); }} tintColor={colors.accent} />}>
    <View style={ui.spread}><View style={ui.row}><View style={{ height: 30, width: 30, borderRadius: 15, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }}><AppIcon name="checkmark" size={18} color="white" /></View><Text style={{ fontSize: 16, fontWeight: '600', color: colors.ink, letterSpacing: -.5 }}>one less thing</Text></View>
      <Pressable style={ui.iconButton} onPress={() => navigation.navigate('Main', { screen: 'Preferences' })} accessibilityRole="button" accessibilityLabel="Open preferences"><AppIcon name="options-outline" size={20} color={colors.ink} /></Pressable></View>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>A LITTLE LESS TO THINK ABOUT</Text><Text style={ui.title}>Dressed for your day.</Text></View>
    <Pressable onPress={() => navigation.navigate('Location')} accessibilityRole="button" accessibilityLabel="Change location" style={({ pressed }) => [ui.spread, { opacity: pressed ? .6 : 1, minHeight: 44, marginTop: -9 }]}>
      <View style={[ui.row, { flex: 1 }]}><AppIcon name="location-outline" size={17} color={colors.accent} /><Text style={[ui.text, { fontSize: 14, flexShrink: 1 }]}>{data ? `${data.location.name}${data.location.state ? ', ' + data.location.state : ', ' + data.location.country}` : 'Choose your city'}</Text></View><AppIcon name="chevron-down" size={16} color={colors.muted} /></Pressable>
    <ModeNotice />
    {(!ready || (loading && !data)) && <View style={[ui.card, { alignItems: 'center', paddingVertical: 42 }]}><ActivityIndicator color={colors.accent} /><Text style={ui.muted}>Putting your day together…</Text></View>}
    {!!error && <View style={ui.notice}><Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>{!!data && <Text style={ui.muted}>Showing your previous result. It may be out of date.</Text>}<Button label="Try again" onPress={() => { void load(); }} secondary loading={loading} /></View>}
    {ready && !loading && !data && !error && <EmptyState title="Your day starts here." description="Choose a city to get the weather and a simple outfit for it. No account needed." action={<Button label="Choose a city" onPress={() => navigation.navigate('Location')} />} />}
    {data && <>
      {stale && <View style={ui.notice}><Text style={ui.muted}>This weather was fetched more than 15 minutes ago. Refresh before heading out.</Text><Button label="Refresh weather" secondary onPress={() => { void load(); }} loading={loading} /></View>}
      <WeatherPanel data={data} unit={preferences.unit} stale={stale} />
      <View style={{ gap: 12 }}><View style={ui.spread}><Text style={ui.eyebrow}>YOUR OUTFIT, SORTED</Text><View style={{ borderRadius: 20, backgroundColor: colors.tint, paddingHorizontal: 10, paddingVertical: 6 }}><Text style={{ fontSize: 10, color: colors.accent, fontWeight: '600' }}>Weather considered</Text></View></View><Text style={ui.heading}>{data.outfit.title}</Text><Text style={ui.text}>{weatherText(data.outfit.summary, preferences.unit)}</Text></View>
      <OutfitBoard data={data} unit={preferences.unit} />
      <Button label={currentSaved ? 'Saved to your collection' : 'Save this outfit'} icon={currentSaved ? 'checkmark' : 'bookmark-outline'} onPress={saveCurrent} disabled={currentSaved || loading} />
      {data.outfit.tips.map(tip => <View key={tip} style={[ui.card, { backgroundColor: '#E9EEDF', borderWidth: 0, flexDirection: 'row', alignItems: 'flex-start' }]}><AppIcon name="sparkles-outline" size={19} color={colors.accent} /><View style={{ flex: 1, gap: 5 }}><Text style={ui.eyebrow}>ONE SMALL REMINDER</Text><Text style={ui.text}>{weatherText(tip, preferences.unit)}</Text></View></View>)}
      {data.forecast.length > 0 && <View style={{ gap: 14 }}><View style={ui.spread}><Text style={ui.heading}>Later on</Text><Pressable onPress={() => navigation.navigate('Main', { screen: 'Forecast' })} accessibilityRole="button" style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: colors.accent, fontSize: 12 }}>Full forecast →</Text></Pressable></View><ForecastStrip data={data} unit={preferences.unit} /></View>}
      {data.warnings.map(warning => <Text key={warning} style={ui.muted}>{warning}</Text>)}
      <Text style={[ui.muted, { textAlign: 'center', fontSize: 11 }]}>{isSampleMode ? 'Sample preview • Not a current weather forecast' : `Weather: OpenWeather · Forecast: Open-Meteo\nObserved ${new Date(data.weather.observedAt).toLocaleString()}`}</Text>
    </>}
  </Screen>;
}

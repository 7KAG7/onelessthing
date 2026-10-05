import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { RefreshControl, Text, View } from 'react-native';
import { Button, EmptyState, ModeNotice, Screen } from '../components/Primitives';
import { colors, ui } from '../components/theme';
import { localHour, temperature, weatherIcon, wind } from '../lib/format';
import { useAppState } from '../state/AppState';
export default function Forecast() {
  const navigation = useAppNavigation();
  const { data, preferences, loading, error, load, stale } = useAppState();
  return <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={() => { void load(); }} tintColor={colors.accent} />}>
    <View style={{ gap: 8 }}><Text style={ui.eyebrow}>AHEAD OF THE WEATHER</Text><Text style={ui.title}>A little foresight.</Text><Text style={ui.muted}>{data ? `${data.location.name} · Hours shown in this location’s time` : 'A simple look at what is coming next'}</Text></View>
    <ModeNotice />
    {stale && <View style={ui.notice}><Text style={ui.muted}>This forecast was fetched more than 15 minutes ago. Pull to refresh for the latest conditions.</Text></View>}
    {!!error && <View style={ui.notice}><Text accessibilityRole="alert" style={ui.text}>{error}</Text><Button secondary label="Retry forecast" onPress={() => { void load(); }} loading={loading} /></View>}
    {!data ? <EmptyState title="First, pick a place." description="Choose your city on Today to see its hourly forecast." action={<Button label="Choose a city" onPress={() => navigation.navigate('Location')} />} /> : data.forecast.length === 0 ? <EmptyState title="Forecast is taking a moment." description="Your outfit is still available on Today. Try refreshing the forecast in a little while." action={<Button label="Try again" onPress={() => { void load(); }} loading={loading} />} /> : <>
      <View style={[ui.card, { backgroundColor: colors.tint, borderWidth: 0 }]}><Text style={ui.eyebrow}>OVER THE NEXT {data.forecast.length} HOURS</Text><View style={ui.spread}><View><Text style={ui.heading}>{temperature(Math.min(...data.forecast.map(h => h.temperatureF)), preferences.unit)} – {temperature(Math.max(...data.forecast.map(h => h.temperatureF)), preferences.unit)}</Text><Text style={ui.muted}>Temperature range</Text></View><View><Text style={ui.heading}>{Math.round(Math.max(...data.forecast.map(h => h.precipitationChancePct)))}%</Text><Text style={ui.muted}>Peak precipitation</Text></View></View></View>
      <View style={{ gap: 4 }}><View style={[ui.spread, { paddingBottom: 13 }]}><Text style={ui.eyebrow}>BY THE HOUR</Text><Text style={ui.muted}>Temp · Precip. · Wind</Text></View>
        {data.forecast.map(hour => <View key={hour.time} style={[ui.spread, { borderTopWidth: 1, borderTopColor: colors.line, paddingVertical: 18 }]}>
          <Text style={[ui.text, { width: 42, fontSize: 13 }]}>{localHour(hour.time, data.weather.timezoneOffsetSeconds)}</Text>
          <AppIcon name={weatherIcon(hour.condition)} size={23} color={colors.accent} />
          <Text style={[ui.text, { fontWeight: '600', width: 34 }]}>{temperature(hour.temperatureF, preferences.unit)}</Text>
          <Text style={[ui.muted, { width: 43 }]}>{Math.round(hour.precipitationChancePct)}%</Text>
          <Text style={[ui.muted, { width: 64, textAlign: 'right' }]}>{wind(hour.windMph, preferences.unit)}</Text>
        </View>)}
      </View>
    </>}
  </Screen>;
}

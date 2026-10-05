import { AppIcon } from './AppIcon';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { StyleSheet, Text, View } from 'react-native';
import { localHour, temperature, weatherIcon, wind } from '../lib/format';
import type { OutfitResponse, Unit } from '../lib/types';
import { colors, ui } from './theme';
export function WeatherPanel({ data, unit, stale = false }: { data: OutfitResponse; unit: Unit; stale?: boolean }) {
  const { weather } = data;
  return <View style={styles.card}>
    <Svg width="100%" height="100%" style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Defs><LinearGradient id="weatherGradient" x1="0%" y1="0%" x2="100%" y2="100%"><Stop offset="0" stopColor="#345C51" /><Stop offset="1" stopColor="#203F38" /></LinearGradient></Defs>
      <Rect width="100%" height="100%" fill="url(#weatherGradient)" />
    </Svg>
    <View style={ui.spread}><Text style={styles.eyebrow}>{stale ? 'LAST WEATHER UPDATE' : 'OUTSIDE RIGHT NOW'}</Text><Text style={styles.unit}>°{unit}</Text></View>
    <View style={ui.spread}>
      <View style={{ flex: 1 }}><Text adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1} style={styles.temperature}>{temperature(weather.temperatureF, unit)}</Text><Text style={styles.description}>{weather.description}</Text></View>
      <View style={styles.sun}><AppIcon name={weatherIcon(weather.condition, weather.isDay)} size={72} color="#F0CF93" /></View>
    </View>
    <View style={styles.footer}>
      <Text style={styles.detail}>Feels {temperature(weather.feelsLikeF, unit)}</Text><View style={styles.dot} />
      <AppIcon name="leaf-outline" size={14} color="#DCE8DE" /><Text style={styles.detail}>{wind(weather.windMph, unit)}</Text><View style={styles.dot} />
      <AppIcon name="water-outline" size={14} color="#DCE8DE" /><Text style={styles.detail}>{weather.humidityPct}%</Text>
    </View>
  </View>;
}
export function ForecastStrip({ data, unit }: { data: OutfitResponse; unit: Unit }) {
  return <View style={styles.forecast}>
    {data.forecast.slice(0,5).map(hour => <View key={hour.time} style={styles.hour}>
      <Text style={ui.muted}>{localHour(hour.time, data.weather.timezoneOffsetSeconds)}</Text>
      <AppIcon name={weatherIcon(hour.condition)} size={23} color={colors.accent} />
      <Text style={styles.hourTemp}>{temperature(hour.temperatureF, unit)}</Text>
      <Text style={styles.rain}>{Math.round(hour.precipitationChancePct)}%</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  card: { padding: 24, borderRadius: 26, gap: 7, overflow: 'hidden', backgroundColor: '#203F38' },
  eyebrow: { color: '#DFE9DF', fontSize: 10, letterSpacing: 1.5, fontWeight: '600' },
  unit: { color: '#DFE9DF', fontSize: 12, fontWeight: '600' },
  temperature: { color: '#FDFBF3', fontSize: 76, fontWeight: '300', letterSpacing: -5, lineHeight: 87 },
  description: { color: '#F0F3EB', fontSize: 16, marginTop: 0 },
  sun: { width: 94, height: 110, alignItems: 'center', justifyContent: 'center', borderRadius: 60, backgroundColor: '#476B5733' },
  footer: { borderTopWidth: 1, borderTopColor: '#FFFFFF28', paddingTop: 18, marginTop: 17, flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  detail: { color: '#DCE8DE', fontSize: 12 }, dot: { width: 3, height: 3, backgroundColor: '#A5BBAA', borderRadius: 2, marginHorizontal: 3 },
  forecast: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10 }, hour: { alignItems: 'center', gap: 10 },
  hourTemp: { fontSize: 17, fontWeight: '600', color: colors.ink }, rain: { fontSize: 11, color: '#517A78' },
});

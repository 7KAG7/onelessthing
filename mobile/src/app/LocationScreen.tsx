import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, Text, TextInput, View } from 'react-native';
import { Button, Screen } from '../components/Primitives';
import { colors, ui } from '../components/theme';
import { isSampleMode, searchLocations } from '../lib/api';
import { sampleLocations } from '../lib/demo';
import type { LocationRequest, MobileLocation } from '../lib/types';
import { useAppState } from '../state/AppState';
import { requestApproximateLocation } from './locationRequest';
export default function LocationScreen() {
  const navigation = useAppNavigation();
  const { load } = useAppState();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MobileLocation[]>(isSampleMode ? sampleLocations : []);
  const [searching, setSearching] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  const selection = useRef<AbortController | null>(null);
  const actionBusy = useRef(false);
  const busy = selecting || locating;
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selection.current?.abort(); }; }, []);
  useEffect(() => navigation.addListener('blur', () => {
    // Dismissing or navigating away also cancels work while a native transition runs.
    selection.current?.abort();
    actionBusy.current = false;
    setSelecting(false);
    setLocating(false);
  }), [navigation]);
  useEffect(() => {
    const controller = new AbortController();
    if (query.trim().length < 2) return () => controller.abort();
    const timer = setTimeout(() => {
      setSearching(true);
      void searchLocations(query.trim(), controller.signal).then(locations => {
        if (!controller.signal.aborted) { setResults(locations); setError(null); }
      }).catch(err => { if (!controller.signal.aborted) { setResults([]); setError(err instanceof Error ? err.message : 'Search is unavailable.'); } })
        .finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);
  function close() { selection.current?.abort(); Keyboard.dismiss(); if (navigation.canGoBack()) navigation.goBack(); else navigation.replace('Main', { screen: 'Today' }); }
  async function choose(location: LocationRequest) {
    if (actionBusy.current) return;
    actionBusy.current = true;
    const controller = new AbortController(); selection.current = controller;
    Keyboard.dismiss(); setSelecting(true); setError(null);
    const success = await load(location, controller.signal);
    if (!mounted.current || controller.signal.aborted) return;
    setSelecting(false); actionBusy.current = false;
    if (success) close(); else setError('We could not load this location. Try again or choose another city.');
  }
  async function locateDevice() {
    if (actionBusy.current || isSampleMode) return;
    actionBusy.current = true;
    const controller = new AbortController(); selection.current = controller;
    setLocating(true); setError(null);
    try {
      const location = await requestApproximateLocation(controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      const success = await load(location, controller.signal);
      if (!mounted.current || controller.signal.aborted) return;
      if (success) close(); else setError('We could not load weather here. Try searching for a nearby city.');
    } catch (err) { if (mounted.current && !controller.signal.aborted) setError(err instanceof Error ? err.message : 'Location is unavailable. Search for a city instead.'); }
    finally { if (mounted.current) { setLocating(false); actionBusy.current = false; } }
  }
  function updateQuery(value: string) {
    setQuery(value); setError(null);
    if (value.trim().length < 2) { setResults(isSampleMode ? sampleLocations : []); setSearching(false); }
  }
  return <Screen>
    <View style={ui.spread}><Text style={ui.eyebrow}>YOUR CORNER OF THE WORLD</Text><Pressable style={ui.iconButton} onPress={close} accessibilityRole="button" accessibilityLabel="Close location search"><AppIcon name="close" size={22} color={colors.ink} /></Pressable></View>
    <Text style={ui.title}>Where’s your day?</Text>
    <TextInput accessibilityLabel="Search city" placeholder="Search for a city" placeholderTextColor={colors.muted} value={query} onChangeText={updateQuery} style={ui.input} autoCapitalize="words" autoCorrect={false} maxLength={120} returnKeyType="search" onSubmitEditing={() => { if (query.trim() && !isSampleMode) void choose({ city: query.trim() }); }} editable={!busy} />
    {isSampleMode && <View style={ui.notice}><Text style={ui.muted}>Explore one of three sample cities. Connect a live API to search anywhere or use your location.</Text></View>}
    {!isSampleMode && <><Button label="Use my approximate location" onPress={() => { void locateDevice(); }} secondary icon="navigate-outline" loading={locating} disabled={selecting} /><Text style={ui.muted}>On your tap, approximate coordinates are sent to our weather API, OpenWeather and Open-Meteo. You can type a city instead. No background location tracking.</Text></>}
    {error && <Text accessibilityRole="alert" style={[ui.text, { color: colors.error }]}>{error}</Text>}
    {searching && <ActivityIndicator color={colors.accent} />}
    {selecting && <Text accessibilityLiveRegion="polite" style={ui.muted}>Getting the weather for your day…</Text>}
    <View style={{ gap: 8 }}>{results.map(location => <Pressable key={`${location.lat}:${location.lon}`} disabled={busy} accessibilityRole="button" accessibilityLabel={`Select ${location.label}`} onPress={() => { void choose({ lat: location.lat, lon: location.lon }); }} style={({ pressed }) => [ui.card, ui.spread, { padding: 17, opacity: pressed || busy ? .6 : 1 }]}><View style={{ flex: 1 }}><Text style={[ui.text, { fontWeight: '600' }]}>{location.name}</Text><Text style={ui.muted}>{[location.state, location.country].filter(Boolean).join(', ')}</Text></View><AppIcon name="arrow-forward" size={20} color={colors.accent} /></Pressable>)}</View>
    {!searching && !results.length && query.trim().length >= 2 && <Text style={ui.muted}>No matching cities. Try including a state or country.</Text>}
    {!isSampleMode && query.trim().length >= 2 && <Button label={`Use “${query.trim()}”`} onPress={() => { void choose({ city: query.trim() }); }} disabled={busy} />}
  </Screen>;
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState as NativeAppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { fetchOutfit, isSampleMode } from '../lib/api';
import type { LocationRequest, OutfitResponse, Preferences, SavedOutfit } from '../lib/types';
import { defaultPreferences, outfitKey, restorePreferences, restoreSaved } from '../lib/validation';

const STORAGE_KEY = 'onelessthing.mobile.v1';
interface AppState {
  ready: boolean; stale: boolean; preferences: Preferences; data: OutfitResponse | null;
  loading: boolean; error: string | null; storageWarning: string | null; saved: SavedOutfit[];
  setPreferences: (patch: Partial<Preferences>) => void;
  load: (location?: LocationRequest, signal?: AbortSignal) => Promise<boolean>;
  saveCurrent: () => void; removeSaved: (id: string) => void; currentSaved: boolean;
}
const Context = createContext<AppState | null>(null);
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [preferences, setPreferencesState] = useState<Preferences>(defaultPreferences);
  const [saved, setSaved] = useState<SavedOutfit[]>([]);
  const [data, setData] = useState<OutfitResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageWarning, setStorageWarning] = useState<string | null>(null);
  const preferencesRef = useRef(preferences);
  const locationRef = useRef<LocationRequest | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const writes = useRef(Promise.resolve());
  const canPersist = useRef(false);
  const dataRef = useRef<OutfitResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    void AsyncStorage.getItem(STORAGE_KEY).then(raw => {
      if (!mounted.current) return;
      if (raw) {
        const state: unknown = JSON.parse(raw);
        if (state && typeof state === 'object' && 'preferences' in state && 'saved' in state) {
          const restored = restorePreferences(state.preferences);
          preferencesRef.current = restored;
          setPreferencesState(restored);
          setSaved(restoreSaved(state.saved));
        } else { throw new Error('Unrecognized saved data'); }
      }
      canPersist.current = true;
    }).catch(() => { if (mounted.current) setStorageWarning('Saved data could not be read. To protect it, changes will not be saved this session. Try restarting the app.'); })
      .finally(() => { if (mounted.current) setReady(true); });
    return () => { mounted.current = false; requestRef.current?.abort(); };
  }, []);
  useEffect(() => {
    if (!ready || !canPersist.current) return;
    const serialized = JSON.stringify({ preferences, saved });
    writes.current = writes.current.then(() => AsyncStorage.setItem(STORAGE_KEY, serialized))
      .catch(() => { if (mounted.current) setStorageWarning('Changes are visible now, but could not be saved on this device.'); });
  }, [preferences, saved, ready]);
  const setPreferences = useCallback((patch: Partial<Preferences>) => {
    setPreferencesState(current => {
      const next = restorePreferences({ ...current, ...patch });
      preferencesRef.current = next;
      return next;
    });
  }, []);
  const load = useCallback(async (location?: LocationRequest, signal?: AbortSignal) => {
    const next = location || locationRef.current || preferencesRef.current.location || (preferencesRef.current.city ? { city: preferencesRef.current.city } : isSampleMode ? { city: 'Boston' } : null);
    if (!next) return false;
    const previousLocation = locationRef.current;
    locationRef.current = next;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setLoading(true); setError(null);
    const onCancel = () => {
      controller.abort();
      if (requestRef.current === controller) locationRef.current = previousLocation;
    };
    signal?.addEventListener('abort', onCancel, { once: true });
    if (signal?.aborted) onCancel();
    try {
      const response = await fetchOutfit(next, preferencesRef.current, controller.signal);
      if (controller.signal.aborted || !mounted.current) return false;
      setData(response); dataRef.current = response; setNow(Date.now());
      // Retain a stable city identity rounded to roughly 1 km, never exact device coordinates.
      setPreferences({ city: response.location.label, location: { lat: Number(response.location.lat.toFixed(2)), lon: Number(response.location.lon.toFixed(2)) } });
      return true;
    } catch (err) {
      if (!controller.signal.aborted && mounted.current) setError(err instanceof Error ? err.message : 'We could not get the weather. Please try again.');
      return false;
    } finally { signal?.removeEventListener('abort', onCancel); if (requestRef.current === controller && mounted.current) setLoading(false); }
  }, [setPreferences]);
  useEffect(() => { if (ready) void load(); }, [ready, preferences.style, preferences.comfort, load]);
  useEffect(() => {
    const subscription = NativeAppState.addEventListener('change', state => {
      setNow(Date.now());
      if (state === 'active' && dataRef.current && Date.now() - Date.parse(dataRef.current.generatedAt) > 15 * 60 * 1000) void load();
    });
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [load]);
  const stale = !!data && !isSampleMode && now - Date.parse(data.generatedAt) > 15 * 60 * 1000;
  const currentKey = data ? outfitKey(data, isSampleMode) : null;
  const saveCurrent = useCallback(() => {
    if (!data) return;
    const id = outfitKey(data, isSampleMode);
    setSaved(current => current.some(item => item.id === id) ? current : [{ id, savedAt: new Date().toISOString(), sample: isSampleMode, data }, ...current].slice(0, 30));
  }, [data]);
  return <Context.Provider value={{ ready, stale, preferences, data, loading, error, storageWarning, saved, setPreferences, load, saveCurrent,
    currentSaved: saved.some(item => item.id === currentKey), removeSaved: id => setSaved(current => current.filter(item => item.id !== id)) }}>{children}</Context.Provider>;
}
export function useAppState() {
  const value = useContext(Context);
  if (!value) throw new Error('AppProvider is missing');
  return value;
}

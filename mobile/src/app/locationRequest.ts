import Geolocation from '@react-native-community/geolocation';
import { PermissionsAndroid, Platform } from 'react-native';

const locationTimeoutMs = 12_000;
const unavailableMessage = 'Location is unavailable. Search for a city instead.';
const deniedMessage = 'Location access is off. You can search for a city instead.';

function locationError(error: unknown): Error {
  if (error instanceof Error) return error;
  const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
  return new Error(code === 1 ? deniedMessage : code === 3 ? 'Location took too long. Please search for a city instead.' : unavailableMessage);
}

function cancelled(): Error {
  const error = new Error('Location request cancelled.');
  error.name = 'AbortError';
  return error;
}

/** Native one-shot APIs cannot be revoked; ignore their callbacks after dismissal. */
function waitForNative<T>(signal: AbortSignal, start: (resolve: (value: T) => void, reject: (error: unknown) => void) => void, timeoutMs = locationTimeoutMs): Promise<T> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(cancelled()); return; }
    let settled = false;
    const finish = (error: Error | null, value?: T) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      if (error) reject(error); else resolve(value as T);
    };
    const onAbort = () => finish(cancelled());
    const timer = setTimeout(() => finish(new Error('Location took too long. Please search for a city instead.')), timeoutMs);
    signal.addEventListener('abort', onAbort, { once: true });
    try { start(value => finish(null, value), error => finish(locationError(error))); }
    catch (error) { finish(locationError(error)); }
  });
}

/** Call only from the explicit location button. Never request a watch or background access. */
export async function requestApproximateLocation(signal: AbortSignal): Promise<{ lat: number; lon: number }> {
  if (signal.aborted) throw cancelled();
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error(unavailableMessage);

  Geolocation.setRNConfiguration({
    // iOS requests When In Use as part of this tap's one-shot native request.
    // Avoid requestAuthorization's change-only callback on repeat requests.
    skipPermissionRequests: Platform.OS === 'android',
    authorizationLevel: 'whenInUse',
    enableBackgroundLocationUpdates: false,
  });

  if (Platform.OS === 'android') {
    const granted = await waitForNative<string>(signal, (resolve, reject) => {
      void PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION).then(resolve, reject);
    }, 30_000);
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) throw new Error(deniedMessage);
  }
  if (signal.aborted) throw cancelled();

  const position = await waitForNative<{ coords: { latitude: number; longitude: number } }>(signal, (resolve, reject) => {
    // The native timeout also bounds collection if this screen is dismissed.
    const request = Geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: false,
      timeout: locationTimeoutMs,
      maximumAge: 60_000,
    });
    void Promise.resolve(request).catch(reject);
  });
  if (signal.aborted) throw cancelled();
  const { latitude, longitude } = position.coords;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error(unavailableMessage);
  }
  // Return only rounded coordinates; precise device coordinates never reach state/API.
  return { lat: Number(latitude.toFixed(2)), lon: Number(longitude.toFixed(2)) };
}

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const platform = { OS: 'ios' };
let configurations = [];
let nativeRequests = [];
let permissionRequests = [];
let requestPermission = async () => 'granted';
let requestPosition = () => {};
const geolocation = {
  setRNConfiguration(configuration) { configurations.push(configuration); },
  getCurrentPosition(success, failure, options) {
    nativeRequests.push({ success, failure, options });
    return requestPosition(success, failure, options);
  },
};
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === '@react-native-community/geolocation') return geolocation;
  if (id === 'react-native') return {
    Platform: platform,
    PermissionsAndroid: {
      PERMISSIONS: { ACCESS_COARSE_LOCATION: 'android.permission.ACCESS_COARSE_LOCATION' },
      RESULTS: { GRANTED: 'granted' },
      request(permission) { permissionRequests.push(permission); return requestPermission(); },
    },
  };
  return originalLoad.call(this, id, ...args);
};
const { requestApproximateLocation } = require('../.test-dist/mobile/src/app/locationRequest.js');
Module._load = originalLoad;

function reset(os = 'ios') {
  platform.OS = os;
  configurations = []; nativeRequests = []; permissionRequests = [];
  requestPermission = async () => 'granted';
  requestPosition = () => {};
}
const position = (latitude = 42.3601234, longitude = -71.0589123) => ({ coords: { latitude, longitude } });

// Permission/location APIs are not touched merely by importing the app's helper.
test('import does not configure or request location', () => {
  assert.equal(configurations.length, 0);
  assert.equal(permissionRequests.length, 0);
  assert.equal(nativeRequests.length, 0);
});

test('iOS uses a one-shot low-accuracy request and returns rounded coordinates only', async () => {
  reset();
  requestPosition = success => success(position());
  assert.deepEqual(await requestApproximateLocation(new AbortController().signal), { lat: 42.36, lon: -71.06 });
  assert.deepEqual(configurations, [{ skipPermissionRequests: false, authorizationLevel: 'whenInUse', enableBackgroundLocationUpdates: false }]);
  assert.deepEqual(nativeRequests[0].options, { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 });
  assert.equal(permissionRequests.length, 0);
});

test('Android requests only coarse permission before native location', async () => {
  reset('android');
  requestPosition = success => success(position());
  await requestApproximateLocation(new AbortController().signal);
  assert.deepEqual(permissionRequests, ['android.permission.ACCESS_COARSE_LOCATION']);
  assert.equal(configurations[0].skipPermissionRequests, true);
  assert.equal(configurations[0].authorizationLevel, 'whenInUse');
  assert.equal(configurations[0].enableBackgroundLocationUpdates, false);
  assert.equal(nativeRequests.length, 1);
});

test('Android denial or never-ask-again leaves city search available and never reads position', async () => {
  for (const status of ['denied', 'never_ask_again']) {
    reset('android'); requestPermission = async () => status;
    await assert.rejects(requestApproximateLocation(new AbortController().signal), /Location access is off.*search for a city/);
    assert.equal(nativeRequests.length, 0);
  }
});

test('native permission denial and native timeout report useful recovery text', async () => {
  for (const [code, expected] of [[1, /Location access is off/], [3, /too long/], [2, /unavailable/]]) {
    reset(); requestPosition = (_success, failure) => failure({ code, message: 'Native diagnostic' });
    await assert.rejects(requestApproximateLocation(new AbortController().signal), expected);
  }
});

test('already-cancelled requests never touch permission or location', async () => {
  reset(); const controller = new AbortController(); controller.abort();
  await assert.rejects(requestApproximateLocation(controller.signal), { name: 'AbortError' });
  assert.equal(configurations.length, 0); assert.equal(nativeRequests.length, 0);
});

test('cancel during Android permission ignores a later grant', async () => {
  reset('android'); let grant;
  requestPermission = () => new Promise(resolve => { grant = resolve; });
  const controller = new AbortController();
  const pending = requestApproximateLocation(controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort(); await rejected;
  grant('granted'); await Promise.resolve(); await Promise.resolve();
  assert.equal(nativeRequests.length, 0);
});

test('cancel during position ignores late success and error callbacks', async () => {
  reset(); const controller = new AbortController();
  const pending = requestApproximateLocation(controller.signal);
  const rejected = assert.rejects(pending, { name: 'AbortError' });
  controller.abort(); await rejected;
  nativeRequests[0].success(position()); nativeRequests[0].failure({ code: 2 });
  assert.equal(nativeRequests.length, 1);
});

test('a stalled native callback times out and ignores a late location', async context => {
  reset(); context.mock.timers.enable({ apis: ['setTimeout'] });
  const pending = requestApproximateLocation(new AbortController().signal);
  const rejected = assert.rejects(pending, /too long/);
  context.mock.timers.tick(12000); await rejected;
  nativeRequests[0].success(position());
  context.mock.timers.reset();
});

test('a stalled Android permission result also times out before any location is collected', async context => {
  reset('android'); context.mock.timers.enable({ apis: ['setTimeout'] });
  requestPermission = () => new Promise(() => {});
  const pending = requestApproximateLocation(new AbortController().signal);
  const rejected = assert.rejects(pending, /too long/);
  context.mock.timers.tick(30000); await rejected;
  assert.equal(nativeRequests.length, 0);
  context.mock.timers.reset();
});

test('another explicit attempt works after cancellation or denial', async () => {
  reset(); const controller = new AbortController();
  const first = requestApproximateLocation(controller.signal);
  const rejected = assert.rejects(first, { name: 'AbortError' }); controller.abort(); await rejected;
  requestPosition = success => success(position(47.606234, -122.332145));
  assert.deepEqual(await requestApproximateLocation(new AbortController().signal), { lat: 47.61, lon: -122.33 });
  nativeRequests[0].success(position());
  assert.equal(nativeRequests.length, 2);
});

test('invalid native coordinates and native promise rejections cannot reach the weather API', async () => {
  for (const coordinates of [[NaN, 1], [1, Infinity], [91, 0], [0, -181]]) {
    reset(); requestPosition = success => success(position(...coordinates));
    await assert.rejects(requestApproximateLocation(new AbortController().signal), /unavailable/);
  }
  reset(); requestPosition = () => Promise.reject({ code: 2 });
  await assert.rejects(requestApproximateLocation(new AbortController().signal), /unavailable/);
});

test('installed geolocation patch keeps the codegen flag boolean and iOS honors explicit false', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const packageDirectory = path.dirname(require.resolve('@react-native-community/geolocation/package.json'));
  const spec = fs.readFileSync(path.join(packageDirectory, 'js/NativeRNCGeolocation.ts'), 'utf8');
  const native = fs.readFileSync(path.join(packageDirectory, 'ios/RNCGeolocation.mm'), 'utf8');
  assert.doesNotMatch(spec, /enableBackgroundLocationUpdates\?: string/);
  assert.match(spec, /enableBackgroundLocationUpdates\?: boolean/);
  assert.match(native, /\.enableBackgroundLocationUpdates = \[RCTConvert BOOL:options\[@"enableBackgroundLocationUpdates"\]\]/);
});

test('generated iOS signatures match the conditional native adapters (not native compilation)', () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { execFileSync } = require('node:child_process');
  const appDirectory = path.resolve(__dirname, '..');
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'olt-geolocation-codegen-'));
  try {
    execFileSync(process.execPath, [
      path.join(appDirectory, 'node_modules/react-native/scripts/generate-codegen-artifacts.js'),
      '-p', appDirectory, '-t', 'ios', '-o', output,
    ], { cwd: appDirectory, stdio: 'pipe', timeout: 30000 });
    const generated = fs.readFileSync(path.join(output, 'build/generated/ios/ReactCodegen/RNCGeolocationSpec/RNCGeolocationSpec.h'), 'utf8');
    const native = fs.readFileSync(path.join(appDirectory, 'node_modules/@react-native-community/geolocation/ios/RNCGeolocation.mm'), 'utf8');
    assert.match(generated, /std::optional<bool> enableBackgroundLocationUpdates\(\) const/);
    for (const [method, type] of [['setConfiguration', 'SpecSetConfigurationConfig'], ['getCurrentPosition', 'GeolocationOptions'], ['startObserving', 'GeolocationOptions']]) {
      const signature = `${method}:(JS::NativeRNCGeolocation::${type} &)`;
      assert.ok(generated.includes(signature), `Codegen signature missing: ${signature}`);
      assert.ok(native.includes(signature), `Native adapter missing: ${signature}`);
    }
    assert.match(native, /<CLLocationManagerDelegate, NativeRNCGeolocationSpec>/);
    assert.match(native, /config\.enableBackgroundLocationUpdates\(\)\.value_or\(false\)/);
    assert.match(native, /getCurrentPositionWithOptions:RNCGeolocationOptionsFromSpec\(options\)/);
    assert.match(native, /startObservingWithOptions:RNCGeolocationOptionsFromSpec\(options\)/);
    assert.match(native, /#else\s+RCT_REMAP_METHOD\(setConfiguration, setConfiguration:\(RNCGeolocationConfiguration\)config\)/);
    assert.match(native, /#else\s+RCT_REMAP_METHOD\(getCurrentPosition, getCurrentPosition:\(RNCGeolocationOptions\)options/);
    assert.match(native, /#else\s+RCT_REMAP_METHOD\(startObserving, startObserving:\(RNCGeolocationOptions\)options\)/);
  } finally { fs.rmSync(output, { recursive: true, force: true }); }
});

test('a native one-shot error stops collection after callbacks and timers are cleared', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const packageDirectory = path.dirname(require.resolve('@react-native-community/geolocation/package.json'));
  const native = fs.readFileSync(path.join(packageDirectory, 'ios/RNCGeolocation.mm'), 'utf8');
  const start = native.indexOf('- (void)locationManager:(CLLocationManager *)manager didFailWithError:(NSError *)error');
  assert.ok(start >= 0);
  const failureHandler = native.slice(start, native.indexOf('#ifdef RCT_NEW_ARCH_ENABLED', start));
  assert.match(failureHandler, /request\.errorBlock\(@\[jsError\]\);\s+\[request\.timeoutTimer invalidate\];/);
  assert.match(failureHandler, /\[_pendingRequests removeAllObjects\];\s*(?:\/\/[^\n]*\n\s*)?if \(!_observingLocation\) \{\s*\[self stopMonitoring\];\s*\}/);
});

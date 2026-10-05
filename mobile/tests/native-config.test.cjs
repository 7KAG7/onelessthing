const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {validateReleaseConfig}=require('../scripts/validate-release-config.cjs');
const file=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('release builds reject sample, insecure or credential-bearing API config',()=>{
  for(const apiBaseUrl of ['', 'http://localhost:3000','https://name:secret@api.test','https://api.example','https://api.test?q=secret','https://api.test#token']) assert.throws(()=>validateReleaseConfig({apiBaseUrl}));
  assert.equal(validateReleaseConfig({apiBaseUrl:'https://api.onelessthing.life'}),true);
});
test('native project and app entry agree on identity and guarded release build',()=>{
  assert.equal(JSON.parse(file('app.json')).name,'OneLessThing');
  assert.match(file('index.js'),/AppRegistry.registerComponent/);
  assert.doesNotMatch(file('ios/OneLessThing.xcodeproj/xcshareddata/xcschemes/OneLessThing.xcscheme'),/OneLessThingTests/);
  assert.match(file('ios/OneLessThing/AppDelegate.swift'),/withModuleName: "OneLessThing"/);
  assert.match(file('ios/OneLessThing.xcworkspace/contents.xcworkspacedata'),/OneLessThing.xcodeproj/);
  assert.match(file('ios/OneLessThing.xcodeproj/project.pbxproj'),/scripts\/xcode-bundle.sh/);
  assert.match(file('scripts/xcode-bundle.sh'),/validate-release-config/);
  assert.match(file('android/app/build.gradle'),/task.dependsOn\("validateReleaseConfig"\)/);
});
test('native permissions are foreground and approximate only',()=>{
  const plist=file('ios/OneLessThing/Info.plist');
  assert.match(plist,/NSLocationWhenInUseUsageDescription/);assert.match(plist,/NSLocationDefaultAccuracyReduced/);
  assert.doesNotMatch(plist,/NSLocationAlways|UIBackgroundModes/);
  const manifest=file('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest,/ACCESS_COARSE_LOCATION/);assert.match(manifest,/ACCESS_FINE_LOCATION" tools:node="remove"/);assert.match(manifest,/ACCESS_BACKGROUND_LOCATION" tools:node="remove"/);
  assert.match(manifest,/enableOnBackInvokedCallback="false"/);
  assert.match(file('android/app/src/main/java/life/onelessthing/mobile/MainActivity.kt'),/RNScreensFragmentFactory/);
});

test('no signing keys or hard-coded debug signing credentials are packaged',()=>{
  assert.equal(fs.existsSync(path.join(__dirname,'../android/app/debug.keystore')),false);
  const gradle=file('android/app/build.gradle');
  assert.doesNotMatch(gradle,/storePassword|keyPassword|storeFile file/);
  assert.match(gradle,/signingConfig signingConfigs.debug/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { act, create } = require('react-test-renderer');
const Module = require('node:module');
global.IS_REACT_ACT_ENVIRONMENT = true;
let read = async () => null;
let writes = [];
let activeListener;
const storage = { getItem: (...args) => read(...args), setItem: async (key,value) => { writes.push({key,value}); } };
const originalLoad = Module._load;
Module._load = function(id, ...args) {
  if (id === '@react-native-async-storage/async-storage') return storage;
  if (id === 'react-native') return { AppState: { addEventListener: (_, listener) => { activeListener=listener; return {remove(){ activeListener=undefined; }}; } } };
  return originalLoad.call(this,id,...args);
};
const { AppProvider, useAppState } = require('../.test-dist/mobile/src/state/AppState.js');
Module._load = originalLoad;
let state;
function Probe() { state=useAppState(); return null; }
async function mount() {
  let root;
  await act(async () => { root=create(React.createElement(AppProvider,null,React.createElement(Probe))); });
  return root;
}
async function unmount(root) { await act(async () => root.unmount()); }
test('sample load, preference changes, duplicate saves and removal work', async () => {
  read=async()=>null; writes=[];
  const root=await mount();
  try {
    assert.equal(state.ready,true); assert.equal(state.data.location.name,'Boston');
    await act(async()=>state.setPreferences({comfort:'warmer'}));
    assert.equal(state.data.preferences.comfort,'warmer');
    await act(async()=>{state.saveCurrent();state.saveCurrent();});
    assert.equal(state.saved.length,1); assert.equal(state.currentSaved,true);
    await act(async()=>state.load({lat:47.61,lon:-122.33}));
    assert.equal(state.data.location.name,'Seattle'); assert.equal(state.currentSaved,false);
    await act(async()=>state.removeSaved(state.saved[0].id));
    assert.equal(state.saved.length,0);
    assert.ok(writes.length>0);
  } finally { await unmount(root); }
});
test('failed storage hydration never writes empty defaults over saved data', async () => {
  read=async()=>{throw new Error('transient read failure');};writes=[];
  const root=await mount();
  try {
    assert.equal(state.ready,true); assert.match(state.storageWarning,/protect/);
    await act(async()=>state.setPreferences({unit:'C'}));
    await act(async()=>state.saveCurrent());
    assert.equal(writes.length,0);
  } finally { await unmount(root); }
});
test('corrupt JSON is protected and stable coordinates survive restart', async () => {
  read=async()=>'{broken';writes=[];
  let root=await mount();
  assert.match(state.storageWarning,/protect/);assert.equal(writes.length,0);await unmount(root);
  read=async()=>JSON.stringify({preferences:{style:'female',comfort:'neutral',unit:'C',city:'Seattle, US',location:{lat:47.61,lon:-122.33}},saved:[]});
  root=await mount();
  try {assert.equal(state.data.location.name,'Seattle');assert.equal(state.preferences.unit,'C');assert.equal(state.data.preferences.style,'female');}
  finally {await unmount(root);}
});
test('an explicitly cancelled selection never overwrites current city', async()=>{
  read=async()=>null;writes=[];const root=await mount();
  try {
    const controller=new AbortController();controller.abort();
    await act(async()=>state.load({lat:47.61,lon:-122.33},controller.signal));
    assert.equal(state.data.location.name,'Boston');assert.equal(state.loading,false);
    await act(async()=>state.load());
    assert.equal(state.data.location.name,'Boston');
  } finally {await unmount(root);}
});
test('closing during a pending selection aborts it and preserves the old outfit', async()=>{
  read=async()=>null;writes=[];const root=await mount();
  const api=require('../.test-dist/mobile/src/lib/api.js');
  const originalFetch=api.fetchOutfit;
  let requestSignal;
  api.fetchOutfit=(_location,_preferences,signal)=>new Promise((_resolve,reject)=>{
    requestSignal=signal;
    signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true});
  });
  try {
    const controller=new AbortController();let pending;
    await act(async()=>{pending=state.load({lat:47.61,lon:-122.33},controller.signal);});
    assert.equal(state.loading,true);
    await act(async()=>{controller.abort();await pending;});
    assert.equal(requestSignal.aborted,true);assert.equal(state.loading,false);
    assert.equal(state.data.location.name,'Boston');assert.equal(state.error,null);
  } finally {api.fetchOutfit=originalFetch;await unmount(root);}
});

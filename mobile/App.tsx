import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { AppProvider } from './src/state/AppState';
export default function App() {
  return <SafeAreaProvider><StatusBar barStyle="dark-content" /><AppProvider><AppNavigator /></AppProvider></SafeAreaProvider>;
}

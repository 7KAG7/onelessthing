import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DefaultTheme, NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TodayScreen from '../app/TodayScreen';
import ForecastScreen from '../app/ForecastScreen';
import SavedScreen from '../app/SavedScreen';
import PreferencesScreen from '../app/PreferencesScreen';
import LocationScreen from '../app/LocationScreen';
import PrivacyScreen from '../app/PrivacyScreen';
import NotFoundScreen from '../app/NotFoundScreen';
import { AppIcon, type AppIconName } from '../components/AppIcon';
import { colors } from '../components/theme';
import type { MainTabParamList, RootStackParamList } from './types';
import { linking } from './linking';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabParamList>();
const tabIcons: Record<keyof MainTabParamList, AppIconName> = {
  Today: 'sunny-outline',
  Forecast: 'cloud-outline',
  Saved: 'bookmark-outline',
  Preferences: 'options-outline',
};
const navigationTheme = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: colors.accent, background: colors.background, card: colors.background, text: colors.ink, border: colors.line },
};
type TabIconProps = { color: string; size: number };
const tabIconRenderers = Object.fromEntries(
  Object.entries(tabIcons).map(([name, icon]) => [name, ({ color, size }: TabIconProps) => <AppIcon name={icon} size={size - 1} color={color} />]),
) as Record<keyof MainTabParamList, (props: TabIconProps) => React.JSX.Element>;

function MainTabs() {
  return <Tabs.Navigator initialRouteName="Today" backBehavior="history" screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: colors.accent,
    tabBarInactiveTintColor: colors.muted,
    tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.line, paddingTop: 8 },
    tabBarLabelStyle: { fontSize: 10, fontWeight: '600' },
    tabBarIcon: tabIconRenderers[route.name],
  })}>
    <Tabs.Screen name="Today" component={TodayScreen} />
    <Tabs.Screen name="Forecast" component={ForecastScreen} />
    <Tabs.Screen name="Saved" component={SavedScreen} />
    <Tabs.Screen name="Preferences" component={PreferencesScreen} options={{ title: 'You', tabBarAccessibilityLabel: 'Preferences' }} />
  </Tabs.Navigator>;
}

/** App.tsx provides state, safe-area insets and the native StatusBar. */
export function AppNavigator() {
  return <NavigationContainer theme={navigationTheme} linking={linking}>
    <Stack.Navigator initialRouteName="Main" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Main" component={MainTabs} />
      <Stack.Screen name="Location" component={LocationScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} options={{ presentation: 'modal' }} />
      <Stack.Screen name="NotFound" component={NotFoundScreen} />
    </Stack.Navigator>
  </NavigationContainer>;
}

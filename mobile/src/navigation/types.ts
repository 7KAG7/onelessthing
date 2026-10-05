import { useNavigation, type NavigatorScreenParams } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

export type MainTabParamList = {
  Today: undefined;
  Forecast: undefined;
  Saved: undefined;
  Preferences: undefined;
};

export type RootStackParamList = {
  Main: NavigatorScreenParams<MainTabParamList> | undefined;
  Location: undefined;
  Privacy: undefined;
  NotFound: undefined;
};

/** Root destinations bubble from the tab navigator to its parent stack. */
export const useAppNavigation = () => useNavigation<NativeStackNavigationProp<RootStackParamList>>();

import type { LinkingOptions } from '@react-navigation/native';
import type { RootStackParamList } from './types';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['onelessthing://'],
  config: {
    initialRouteName: 'Main',
    screens: {
      Main: {
        initialRouteName: 'Today',
        screens: { Today: '', Forecast: 'forecast', Saved: 'saved', Preferences: 'preferences' },
      },
      Location: 'location',
      Privacy: 'privacy',
      NotFound: '*',
    },
  },
};

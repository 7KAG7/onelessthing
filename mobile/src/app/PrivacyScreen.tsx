import { AppIcon } from '../components/AppIcon';
import { useAppNavigation } from '../navigation/types';
import { Pressable, Text, View } from 'react-native';
import { Screen } from '../components/Primitives';
import { colors, ui } from '../components/theme';
export default function Privacy() {
  const navigation = useAppNavigation();
  return <Screen><View style={ui.spread}><Text style={ui.eyebrow}>CLEAR AND SIMPLE</Text><Pressable style={ui.iconButton} onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.replace('Main', { screen: 'Preferences' })} accessibilityRole="button" accessibilityLabel="Close privacy information"><AppIcon name="close" size={22} color={colors.ink} /></Pressable></View><Text style={ui.title}>Your day. Your choice.</Text>
    {[
      ['No account required', 'This foundation works without signing up. Your clothing selection, comfort settings, last city (with approximate coordinates) and up to 30 saved outfits are stored locally on your device. Cloud account sync is not yet available.'],
      ['Location is optional', 'Search by city, or tap to use approximate device location. Device coordinates are rounded to two decimal places before leaving the app. We do not request background location access.'],
      ['When weather is live', 'Your selected city or coordinates are sent to the configured One Less Thing API and OpenWeather. Coordinates are also sent to Open-Meteo for hourly forecasts. Clothing preferences go to the app API to choose layers and shopping searches.'],
      ['When you are previewing', 'The clearly labeled sample preview uses illustrative conditions for Boston, Seattle and Austin. It makes no weather-provider requests and does not request location permission.'],
      ['Shopping is your call', 'Outfit suggestions are generic categories, not owned wardrobe items or guaranteed product matches. Tapping Find similar opens an Amazon search containing the item and your clothing selection. Affiliate links may earn a commission without an extra cost to you.'],
      ['A helpful starting point', 'Outfits are rule-based suggestions, not safety advice. Check official alerts and use your judgment in severe weather. A production privacy policy, support contact and data deletion process must be supplied before App Store release.'],
    ].map(([title, body]) => <View key={title} style={{ gap: 8 }}><Text style={ui.heading}>{title}</Text><Text style={ui.text}>{body}</Text></View>)}
  </Screen>;
}

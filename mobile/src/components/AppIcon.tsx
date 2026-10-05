import Svg, { Circle, G, Path } from 'react-native-svg';

const paths = {
  'checkmark': 'M5 12 10 17 20 7',
  'close': 'm6 6 12 12M6 18 18 6',
  'chevron-down': 'm6 9 6 6 6-6',
  'chevron-up': 'm6 15 6-6 6 6',
  'arrow-forward': 'M4 12h16m-6-6 6 6-6 6',
  'arrow-up-right-box-outline': 'M14 3h7v7m0-7L10 14M11 5H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6',
  'bookmark-outline': 'M6 3h12v18l-6-4-6 4Z',
  'bookmark': 'M6 3h12v18l-6-4-6 4Z',
  'options-outline': 'M4 6h9m4 0h3M4 12h3m4 0h9M4 18h9m4 0h3M13 3v6M7 9v6m6 0v6',
  'location-outline': 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z',
  'navigate-outline': 'm3 11 18-8-8 18-2-8Z',
  'shield-checkmark-outline': 'M12 2 3 6v6c0 5 9 10 9 10s9-5 9-10V6ZM8 12l3 3 5-6',
  'flask-outline': 'M9 3h6m-5 0v6l-6 10a1.4 1.4 0 0 0 1.2 2h13.6a1.4 1.4 0 0 0 1.2-2L14 9V3M7 15h10',
  'sparkles-outline': 'm12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 2v4m-2-2h4',
  'sunny-outline': 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5',
  'moon-outline': 'M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z',
  'cloud-outline': 'M6 19a5 5 0 1 1 .4-10A7 7 0 0 1 20 10a4.5 4.5 0 0 1-1.5 9Z',
  'partly-sunny-outline': 'M8 2v2M2 8h2m-1-5 1.5 1.5M13 3l-1.5 1.5M3 13l1.5-1.5M8 14a4 4 0 1 1 4-6M8 21a4 4 0 0 1-.5-8A6 6 0 0 1 19 13a4 4 0 0 1 0 8Z',
  'rainy-outline': 'M6 15a4 4 0 0 1 0-8 6 6 0 0 1 11.5 0A4 4 0 1 1 19 15ZM8 18l-1 3m6-3-1 3m6-3-1 3',
  'snow-outline': 'M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M4 14l4 1-1 4m13-9-4-1 1-4',
  'thunderstorm-outline': 'M6 14a4 4 0 0 1 0-8 6 6 0 0 1 11.5 0A4 4 0 1 1 19 14M13 11l-5 7h5l-2 5 7-8h-6Z',
  'leaf-outline': 'M20 3C4 1 0 16 7 20s15-3 13-17ZM4 22 16 10',
  'water-outline': 'M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13ZM8 15a4 4 0 0 0 4 4',
} as const;

export type AppIconName = keyof typeof paths;

/** Original code-native line icons; no font loading or remote assets. */
export function AppIcon({ name, size = 24, color = 'currentColor' }: { name: AppIconName; size?: number; color?: string }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <G fill="none" stroke={color} strokeWidth={1.65} strokeLinecap="round" strokeLinejoin="round">
      <Path d={paths[name]} fill={name === 'bookmark' ? color : 'none'} />
      {name === 'location-outline' && <Circle cx={12} cy={10} r={2.2} />}
      {name === 'sunny-outline' && <Circle cx={12} cy={12} r={4.5} />}
    </G>
  </Svg>;
}

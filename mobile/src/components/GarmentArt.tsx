import React from 'react';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import type { OutfitCategory } from '../lib/types';
/** Original vector illustrations: no scraped retailer imagery or remote image requests. */
export function GarmentArt({ category, size = 90 }: { category: OutfitCategory; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 120 120" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
    <Ellipse cx="60" cy="102" rx="35" ry="5" fill="#223C33" opacity=".07" />
    {category === 'top' ? <G>
      <Path d="M39 22 21 32 8 63 26 72 34 56 32 101 88 101 86 56 94 72 112 63 99 32 81 22 70 17H50Z" fill="#B7BEA5" stroke="#7C8970" strokeWidth="1.5" />
      <Path d="M49 18 60 34 71 18 80 24 70 41 60 34 49 41 39 24Z" fill="#D3D6C5" stroke="#7C8970" strokeWidth="1.5" />
      <Path d="M60 35V101M37 53H52V66H37ZM68 53H83V66H68ZM34 93H87M18 64 27 68M93 68 102 64" fill="none" stroke="#87937A" strokeWidth="1.5" />
      {[48,65,81,94].map(y => <Circle key={y} cx="61" cy={y} r="1.5" fill="#6F7E63" />)}
    </G> : category === 'bottoms' ? <G>
      <Path d="M35 16H85L89 104H64L59 54 54 104H29Z" fill="#D4C9B7" stroke="#9A8E7A" strokeWidth="1.7" />
      <Path d="M35 25H85M59 25V53M63 25V40H59M37 28 33 42M81 28 86 42M30 98H54M64 98H88" fill="none" stroke="#AB9D88" strokeWidth="1.5" />
      <Circle cx="60" cy="21" r="2" fill="#9A8E7A" />
    </G> : category === 'footwear' ? <G>
      <Path d="M20 54 32 38 48 46 57 67 96 75Q108 78 109 91H13V78Z" fill="#ECEBE2" stroke="#9DA69D" strokeWidth="1.7" />
      <Path d="M13 86H109V96H13ZM24 56 38 63 54 58M38 57 54 63M43 64 59 68M49 70 65 74" fill="none" stroke="#9DA69D" strokeWidth="2" />
      <Path d="M67 69 75 62 107 67Q115 71 114 78L98 78Z" fill="#C9D1C6" stroke="#9DA69D" strokeWidth="1.5" />
    </G> : category === 'head' ? <G>
      <Path d="M27 65Q27 26 60 26 93 26 93 65Z" fill="#8A9C8A" stroke="#546E59" strokeWidth="1.6" />
      <Path d="M53 27Q69 38 68 65M30 61H90M27 65Q55 55 93 65L112 77Q78 91 27 73Z" fill="#A7B6A0" stroke="#546E59" strokeWidth="1.6" />
      <Circle cx="60" cy="25" r="3" fill="#546E59" />
    </G> : <G>
      <Path d="M12 51H50L47 76Q27 88 16 71ZM70 51H108L104 71Q93 88 73 76Z" fill="#67736A" stroke="#35483E" strokeWidth="3" />
      <Path d="M49 56Q59 46 71 56M14 52 7 44M108 52 115 44" fill="none" stroke="#35483E" strokeWidth="4" strokeLinecap="round" />
      <Path d="M19 56H43M78 56H100" stroke="#AAB9A5" strokeWidth="3" opacity=".5" />
    </G>}
  </Svg>;
}

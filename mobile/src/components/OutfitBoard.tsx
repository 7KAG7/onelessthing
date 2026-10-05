import { AppIcon } from './AppIcon';
import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OutfitResponse, Unit } from '../lib/types';
import { weatherText } from '../lib/format';
import { safeShopUrl } from '../lib/validation';
import { GarmentArt } from './GarmentArt';
import { colors, ui } from './theme';
export function OutfitBoard({ data, unit, compact = false }: { data: OutfitResponse; unit: Unit; compact?: boolean }) {
  const [error, setError] = useState<string | null>(null);
  async function openShop(url: string) {
    if (!safeShopUrl(url)) { setError('This shopping link is unavailable.'); return; }
    try { await Linking.openURL(url); } catch { setError('We could not open your browser. Please try again.'); }
  }
  return <View style={{ gap: 18 }}>
    {!compact && <View style={styles.board}>
      <View style={styles.boardLabel}><Text style={ui.eyebrow}>THE EVERYDAY EDIT</Text><Text style={styles.boardNote}>A few good essentials</Text></View>
      <View style={styles.artRow}><View style={{ flex: 1, alignItems: 'center' }}><GarmentArt category="top" size={136} /><Text style={styles.artLabel}>YOUR LAYER</Text></View><View style={{ flex: 1, alignItems: 'center' }}><GarmentArt category="bottoms" size={132} /><Text style={styles.artLabel}>YOUR FOUNDATION</Text></View></View>
      <View style={styles.artBottom}><GarmentArt category="head" size={78} /><GarmentArt category="footwear" size={111} /><GarmentArt category="accessory" size={75} /></View>
      <Text style={styles.illustrationNote}>Illustrations represent categories, not specific products</Text>
    </View>}
    <Text style={ui.muted}>Start with what you own. “Find similar” opens an Amazon search; affiliate links may earn a commission at no extra cost to you.</Text>
    {data.outfit.pieces.map((piece, index) => <View key={piece.id} style={styles.piece}>
      <View style={styles.pieceArt}><GarmentArt category={piece.category} size={64} /></View>
      <View style={{ flex: 1, gap: 5 }}><Text style={styles.category}>{String(index + 1).padStart(2, '0')} / {piece.category === 'top' ? 'LAYER' : piece.category.toUpperCase()}</Text><Text style={styles.name}>{piece.name}</Text><Text style={ui.muted}>{weatherText(piece.reason, unit)}</Text>
        <Pressable onPress={() => { void openShop(piece.searchUrl); }} accessibilityRole="link" accessibilityLabel={`Find similar ${piece.name} on Amazon, opens browser`} style={({ pressed }) => [styles.link, { opacity: pressed ? .6 : 1 }]}><Text style={styles.linkText}>Find similar</Text><AppIcon name="arrow-up-right-box-outline" size={14} color={colors.accent} /></Pressable>
      </View>
    </View>)}
    {error && <Text accessibilityRole="alert" style={[ui.muted, { color: colors.error }]}>{error}</Text>}
  </View>;
}
const styles = StyleSheet.create({
  board: { backgroundColor: '#E9EBE1', borderRadius: 25, padding: 20, gap: 14, borderWidth: 1, borderColor: '#DDE2D5' },
  boardLabel: { gap: 6 }, boardNote: { color: colors.ink, fontSize: 14 },
  artRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginHorizontal: -12 },
  artBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly' },
  artLabel: { color: '#6A7769', fontSize: 8, fontWeight: '600', letterSpacing: 1.2 },
  illustrationNote: { color: '#6A7769', fontSize: 10, textAlign: 'center' },
  piece: { flexDirection: 'row', gap: 14, paddingBottom: 16, borderBottomColor: colors.line, borderBottomWidth: 1 },
  pieceArt: { backgroundColor: '#EBEEE6', width: 74, height: 79, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  category: { color: colors.muted, fontSize: 9, letterSpacing: 1.2, fontWeight: '700' },
  name: { color: colors.ink, fontSize: 16, fontWeight: '600' },
  link: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 10, minHeight: 44 },
  linkText: { color: colors.accent, fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
});

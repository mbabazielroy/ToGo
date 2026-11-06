import { Image, View, Text, StyleSheet } from 'react-native';
import { APP_VARIANT } from '../env';
import { colors } from '../theme';

const LOGO = require('../../assets/logo.png');

/**
 * The app's logo at any size: the ToGo bus artwork (same as the app icon). ToGo Staff
 * keeps its own green "T" mark so crews can tell the two apps apart.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  const radius = Math.round(size * 0.225);
  if (APP_VARIANT === 'staff') {
    return (
      <View style={[styles.staff, { width: size, height: size, borderRadius: radius }]}>
        <Text style={[styles.staffText, { fontSize: Math.round(size * 0.58) }]}>T</Text>
      </View>
    );
  }
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size, borderRadius: radius }}
      accessibilityRole="image"
      accessibilityLabel="ToGo"
    />
  );
}

const styles = StyleSheet.create({
  staff: { backgroundColor: colors.forest700, alignItems: 'center', justifyContent: 'center' },
  staffText: { color: colors.white, fontWeight: '900' },
});

import { View } from 'react-native';
import QRCodeSvg from 'react-native-qrcode-svg';
import { colors } from '../theme';

/** Real, scannable QR (SVG) — works in Expo Go via react-native-svg. */
export function QRCode({ value, size = 150 }: { value: string; size?: number }) {
  return (
    <View accessibilityLabel="Boarding QR code" style={{ backgroundColor: colors.white, padding: 6, borderRadius: 10 }}>
      <QRCodeSvg value={value} size={size} color={colors.forest900} backgroundColor={colors.white} />
    </View>
  );
}

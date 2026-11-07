import { Image } from 'react-native';
import { APP_VARIANT } from '../env';

const LOGO = require('../../assets/logo.png');
const LOGO_STAFF = require('../../assets/logo-staff.png');

/** The app's logo at any size, matching the app icon: the ToGo bus, or for
 *  ToGo Staff the same bus on a dark tile with a STAFF badge. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <Image
      source={APP_VARIANT === 'staff' ? LOGO_STAFF : LOGO}
      style={{ width: size, height: size, borderRadius: Math.round(size * 0.225) }}
      accessibilityRole="image"
      accessibilityLabel={APP_VARIANT === 'staff' ? 'ToGo Staff' : 'ToGo'}
    />
  );
}

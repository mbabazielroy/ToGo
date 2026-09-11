import { useRef } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { PrimaryButton } from '../components/ui';
import { colors, radius, space, font, SCREEN } from '../theme';

/**
 * QR scanner for conductor boarding. Requests explicit camera permission, debounces
 * repeated scans, and NEVER boards on its own — it only returns the scanned code to
 * the caller, which resolves and confirms before boarding. A manual fallback is
 * always available on the conductor screen when permission is denied or unavailable.
 */
export function QrScanner({
  visible, onClose, onCode,
}: { visible: boolean; onClose: () => void; onCode: (raw: string) => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const lastRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  const web = Platform.OS === 'web';
  const granted = permission?.granted;

  function handleScan(data: string) {
    const now = Date.now();
    // Debounce identical scans within 2.5s.
    if (data === lastRef.current.code && now - lastRef.current.at < 2500) return;
    lastRef.current = { code: data, at: now };
    onCode(data);
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Text style={styles.title}>Scan boarding QR</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close scanner" hitSlop={10} style={styles.close}>
            <Ionicons name="close" size={26} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {web ? (
            <Fallback text="Camera scanning isn’t available in the web preview. Close this and enter the boarding code manually." onClose={onClose} />
          ) : !permission ? (
            <Fallback text="Preparing the camera…" />
          ) : !granted ? (
            <View style={styles.center}>
              <Ionicons name="camera-outline" size={40} color={colors.white} />
              <Text style={styles.permText}>ToGo needs camera access to scan boarding QR codes. You can also enter the code manually.</Text>
              <View style={{ width: '100%', gap: space.sm }}>
                <PrimaryButton title="Allow camera" onPress={requestPermission} />
                <Pressable onPress={onClose} accessibilityRole="button"><Text style={styles.manualLink}>Enter code manually instead</Text></Pressable>
              </View>
            </View>
          ) : (
            <>
              <CameraView
                style={StyleSheet.absoluteFill}
                barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                onBarcodeScanned={(r) => handleScan(r.data)}
              />
              <View pointerEvents="none" style={styles.reticle} />
              <Text style={styles.hint}>Point at the passenger’s boarding QR</Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function Fallback({ text, onClose }: { text: string; onClose?: () => void }) {
  return (
    <View style={styles.center}>
      <Ionicons name="qr-code-outline" size={40} color={colors.white} />
      <Text style={styles.permText}>{text}</Text>
      {onClose && <PrimaryButton title="Enter code manually" onPress={onClose} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0b0f0c' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN, paddingVertical: space.sm },
  title: { color: colors.white, fontSize: font.title, fontWeight: '700' },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.xl },
  permText: { color: colors.white, textAlign: 'center', fontSize: font.body, lineHeight: 23 },
  manualLink: { color: colors.white, textAlign: 'center', fontWeight: '600', fontSize: font.small, paddingVertical: 8 },
  reticle: { position: 'absolute', alignSelf: 'center', top: '30%', width: 220, height: 220, borderWidth: 3, borderColor: 'rgba(255,255,255,0.9)', borderRadius: radius.lg },
  hint: { position: 'absolute', bottom: 48, alignSelf: 'center', color: colors.white, fontSize: font.body, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill },
});

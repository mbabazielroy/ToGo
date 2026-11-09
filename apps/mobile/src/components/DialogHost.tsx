import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, Text, View } from 'react-native';
import { setDialogListener, type DialogRequest } from '@/lib/dialog';
import { makeStyles, radius, space, font, control } from '@/theme';

/**
 * Web only: shows `ask()` confirmations as an in-app dialog with real buttons
 * (phones use the system alert). Escape or tapping outside picks the Cancel button.
 */
export function DialogHost() {
  const styles = useStyles();
  const [req, setReq] = useState<DialogRequest | null>(null);

  useEffect(() => (Platform.OS === 'web' ? setDialogListener(setReq) : undefined), []);
  if (Platform.OS !== 'web' || !req) return null;

  const cancel = req.buttons.find((b) => b.style === 'cancel');
  const choose = (b?: DialogRequest['buttons'][number]) => { setReq(null); b?.onPress?.(); };
  const stacked = req.buttons.length > 2 || req.buttons.some((b) => (b.text ?? '').length > 14);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => choose(cancel)}>
      <Pressable style={styles.backdrop} onPress={() => choose(cancel)} accessibilityLabel="Close" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card} role="alertdialog" aria-modal aria-label={req.title}>
          <Text style={styles.title} role="heading">{req.title}</Text>
          {req.message ? <Text style={styles.message}>{req.message}</Text> : null}
          <View style={[styles.buttons, stacked && styles.stacked]}>
            {req.buttons.map((b, i) => (
              <Pressable
                key={`${b.text}-${i}`}
                onPress={() => choose(b)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, !stacked && { flex: 1 }, b.style !== 'cancel' && styles.buttonAction, b.style === 'destructive' && styles.buttonDestructive, pressed && { opacity: 0.7 }]}
              >
                <Text style={[styles.buttonText, b.style === 'cancel' && styles.cancelText, b.style === 'destructive' && styles.destructiveText]}>
                  {b.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.scrim },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: { width: '100%', maxWidth: 340, backgroundColor: colors.surface, borderRadius: radius.xxl, padding: space.lg, gap: space.sm },
  title: { fontSize: font.title, fontWeight: '700', color: colors.ink, textAlign: 'center' },
  message: { fontSize: font.small, color: colors.inkSoft, textAlign: 'center', lineHeight: 21 },
  buttons: { flexDirection: 'row', gap: space.sm, marginTop: space.sm },
  stacked: { flexDirection: 'column' },
  button: { minHeight: control.small, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.md, backgroundColor: colors.surfaceAlt },
  buttonAction: { backgroundColor: colors.forest100 },
  buttonDestructive: { backgroundColor: colors.red100 },
  buttonText: { fontSize: font.body, fontWeight: '600', color: colors.forest700 },
  cancelText: { color: colors.ink, fontWeight: '500' },
  destructiveText: { color: colors.red700 },
}));

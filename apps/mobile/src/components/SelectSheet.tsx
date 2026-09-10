import type { ReactNode } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius, space, font, SCREEN } from '../theme';

/**
 * A focused bottom selection sheet built on RN `Modal` — used to move direction,
 * date, and the full hub list off the Home screen. Dismisses on backdrop tap,
 * close button, and Android hardware Back (onRequestClose). Content scrolls.
 */
export function SelectSheet({
  visible, title, onClose, children,
}: { visible: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Dismiss" accessibilityRole="button" />
        <View style={[styles.panel, { paddingBottom: insets.bottom + space.lg }]}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={22} color={colors.ink} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15,20,15,0.35)' },
  panel: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xxl, borderTopRightRadius: radius.xxl, maxHeight: '86%' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN, paddingTop: space.lg, paddingBottom: space.sm },
  title: { fontSize: font.h2, fontWeight: '800', color: colors.ink },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: SCREEN, paddingBottom: space.sm, gap: space.sm },
});

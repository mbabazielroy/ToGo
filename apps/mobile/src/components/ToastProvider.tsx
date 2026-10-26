import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Text, StyleSheet, Animated, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, font } from '../theme';

type Tone = 'ok' | 'error';
const Ctx = createContext<(msg: string, tone?: Tone) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ msg: string; tone: Tone } | null>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insets = useSafeAreaInsets();

  const show = useCallback((msg: string, tone: Tone = 'ok') => {
    setToast({ msg, tone });
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: true }).start();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => setToast(null));
    }, 2600);
  }, [opacity]);

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <Animated.View pointerEvents="none" style={[styles.wrap, { opacity, top: insets.top + 8 }]} accessibilityLiveRegion="polite">
          <View style={[styles.toast, { backgroundColor: toast.tone === 'ok' ? colors.forest700 : colors.red600 }]}>
            <Text style={styles.text}>{toast.msg}</Text>
          </View>
        </Animated.View>
      )}
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}

const styles = StyleSheet.create({
  // Top of the screen so it never covers the primary action at the bottom.
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  toast: { borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 10, maxWidth: '90%', shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 6 },
  text: { color: colors.white, fontWeight: '700', fontSize: font.small, textAlign: 'center' },
});

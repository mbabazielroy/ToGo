import { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAppMode } from '@/data/AdapterProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, space, font, radius, control } from '@/theme';
import { APP_VARIANT } from '@/env';
import { Redirect } from 'expo-router';

interface Slide { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string }

const SLIDES: Slide[] = [
  { key: 'reserve', icon: 'bus', title: 'Your seat, reserved in seconds', body: 'Pick a departure between Kampala and Mbarara, choose the hub nearest you, and hold your seat. Pay the operator when you board.' },
  { key: 'time', icon: 'time', title: 'Know exactly when to leave', body: 'Live countdowns to your pickup, plus a heads-up the moment your bus is delayed or arrives at your hub.' },
  { key: 'board', icon: 'qr-code', title: 'Board with one scan', body: 'Check in at your hub and show your boarding pass. The conductor scans it and you are on your way.' },
];

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const mode = useAppMode();
  const { profile, startPassenger } = useSession();
  const returning = !!profile.name.trim();
  const [index, setIndex] = useState(0);
  const list = useRef<FlatList<Slide>>(null);
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  const last = index === SLIDES.length - 1;
  if (APP_VARIANT === 'staff') return <Redirect href="/staff-signin" />;
  async function continueAsReturning() {
    await startPassenger();
    router.replace('/home');
  }
  function next() {
    if (returning) { continueAsReturning(); return; }
    if (last) router.push('/onboarding');
    else {
      list.current?.scrollToOffset({ offset: width * (index + 1), animated: true });
      setIndex(index + 1);
    }
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
      <StatusBar style="light" />
      <View style={styles.brandRow}>
        <View style={styles.logo}><Text style={styles.logoText}>T</Text></View>
        <Text style={styles.brand}>ToGo</Text>
        <View style={{ flex: 1 }} />
        {mode === 'demo' && <View style={styles.previewTag}><Text style={styles.previewText}>Preview</Text></View>}
        {!last && !returning && (
          <Pressable onPress={() => router.push('/onboarding')} accessibilityRole="button" hitSlop={10}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        )}
      </View>

      <FlatList
        ref={list}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        style={{ flexGrow: 0, flex: 1 }}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.art}>
              <View style={styles.ring3} />
              <View style={styles.ring2} />
              <View style={styles.iconCircle}>
                <Ionicons name={item.icon} size={56} color={colors.forest900} />
              </View>
            </View>
            <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />

      <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />)}
      </View>

      <View style={styles.actions}>
        <Pressable onPress={next} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}>
          <Text style={styles.primaryText}>{returning ? `Continue as ${profile.name.trim().split(/\s+/)[0]}` : last ? 'Get started' : 'Next'}</Text>
          <Ionicons name="arrow-forward" size={20} color={colors.forest900} />
        </Pressable>
        {returning && (
          <Pressable onPress={() => router.push('/onboarding')} accessibilityRole="button" style={styles.secondary}>
            <Text style={styles.secondaryText}>Not {profile.name.trim().split(/\s+/)[0]}? Set up a new profile</Text>
          </Pressable>
        )}
        {mode === 'connected' && !returning && (
          <Pressable onPress={() => router.push('/auth?next=/onboarding')} accessibilityRole="button" style={styles.secondary}>
            <Text style={styles.secondaryText}>I already have an account</Text>
          </Pressable>
        )}
        {APP_VARIANT === 'combined' ? (
          <Pressable onPress={() => router.push('/staff-signin')} accessibilityRole="button" style={styles.staffLink}>
            <Ionicons name="briefcase-outline" size={16} color={colors.onDarkSoft} />
            <Text style={styles.staffText}>Crew or operations? Sign in to your workspace</Text>
          </Pressable>
        ) : (
          <Text style={[styles.staffText, { textAlign: 'center', paddingVertical: 12 }]}>Crew and operations use the ToGo Staff app.</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.forest900 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, height: 52 },
  logo: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.forest900, fontWeight: '900', fontSize: 16 },
  brand: { color: colors.white, fontWeight: '900', fontSize: 20, letterSpacing: -0.3 },
  previewTag: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginRight: 12 },
  previewText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  skip: { color: colors.onDarkSoft, fontSize: font.body, fontWeight: '600' },

  slide: { paddingHorizontal: 28, justifyContent: 'center' },
  art: { height: 230, alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
  ring3: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(19,168,92,0.10)' },
  ring2: { position: 'absolute', width: 164, height: 164, borderRadius: 82, backgroundColor: 'rgba(19,168,92,0.22)' },
  iconCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  body: { color: colors.onDarkSoft, fontSize: font.body, lineHeight: 25, marginTop: space.md },

  dots: { flexDirection: 'row', gap: 6, paddingHorizontal: 28, marginBottom: space.xl },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotOn: { width: 22, backgroundColor: colors.live },

  actions: { paddingHorizontal: 20, gap: space.sm },
  primary: { flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.live, borderRadius: radius.xl, minHeight: control.height + 4 },
  primaryText: { color: colors.forest900, fontSize: font.body, fontWeight: '800' },
  secondary: { alignItems: 'center', justifyContent: 'center', minHeight: control.height, borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.3)' },
  secondaryText: { color: colors.white, fontSize: font.body, fontWeight: '600' },
  staffLink: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  staffText: { color: colors.onDarkSoft, fontSize: font.small, fontWeight: '500' },
});

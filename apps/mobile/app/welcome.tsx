import { useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useAppMode } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession } from '@/session/SessionProvider';
import { colors, space, font, radius, control } from '@/theme';
import { APP_VARIANT } from '@/env';
import { BrandMark } from '@/components/BrandMark';

interface Slide { key: string; icon: keyof typeof Ionicons.glyphMap; title: string; body: string; logo?: boolean }

const SLIDES: Slide[] = [
  { key: 'reserve', icon: 'bus', logo: true, title: 'Your seat, reserved in seconds', body: 'Pick a departure between Kampala and Mbarara, choose the hub nearest you, and hold your seat. Pay the operator when you board.' },
  { key: 'time', icon: 'time', title: 'Know exactly when to leave', body: 'Live countdowns to your pickup, plus a heads-up the moment your bus is delayed or arrives at your hub.' },
  { key: 'board', icon: 'qr-code', title: 'Board with one scan', body: 'Check in at your hub and show your boarding pass. The conductor scans it and you are on your way.' },
];

/**
 * The entry screen: the first thing a new install shows, and where signing out
 * lands. Three versions:
 *   - first launch: the three intro slides, with "Get started" on every slide;
 *   - welcome back: this phone has been set up before → one tap to continue;
 *   - signed out: the last account signed out → sign in again, or browse.
 */
export default function Welcome() {
  const insets = useSafeAreaInsets();
  const mode = useAppMode();
  const { session } = useAuth();
  const { onboarded, signedOut } = useSession();

  if (APP_VARIANT === 'staff') return <Redirect href="/staff-signin" />;
  const variant = mode === 'connected' && signedOut && !session ? 'signedOut' : onboarded ? 'returning' : 'intro';

  return (
    <View style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + space.lg }]}>
      <StatusBar style="light" />
      <View style={styles.brandRow}>
        <BrandMark size={30} />
        <Text style={styles.brand}>ToGo</Text>
        <View style={{ flex: 1 }} />
        {mode === 'demo' && <View style={styles.previewTag}><Text style={styles.previewText}>Preview</Text></View>}
      </View>
      {variant === 'intro' ? <Intro /> : <Compact variant={variant} />}
    </View>
  );
}

/** First launch: swipeable intro; "Get started" is available on every slide. */
function Intro() {
  const router = useRouter();
  const mode = useAppMode();
  const { width } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const onViewable = useRef(({ viewableItems }: { viewableItems: { index?: number | null }[] }) => {
    if (viewableItems[0]?.index != null) setIndex(viewableItems[0].index);
  }).current;

  return (
    <>
      {/* The slides fill the space above the buttons. A plain flex:1 wrapper is used
          because a FlatList given both flex and flexGrow:0 collapses to zero height
          on iOS and Android (it only looked right on the web). */}
      <View style={styles.slides}>
      <FlatList
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewable}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        style={styles.slides}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={styles.art}>
              <View style={styles.ring3} />
              <View style={styles.ring2} />
              {item.logo ? (
                <BrandMark size={128} />
              ) : (
                <View style={styles.iconCircle}>
                  <Ionicons name={item.icon} size={56} color={colors.forest900} />
                </View>
              )}
            </View>
            <Text style={styles.title} accessibilityRole="header">{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
      />
      </View>

      <View style={styles.dots} accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}. Swipe for more.`}>
        {SLIDES.map((s, i) => <View key={s.key} style={[styles.dot, i === index && styles.dotOn]} />)}
      </View>

      <View style={styles.actions}>
        <Primary title="Get started" onPress={() => router.push('/onboarding')} />
        {mode === 'connected' && (
          <Secondary title="I already have an account" onPress={() => router.push('/auth?next=/onboarding')} />
        )}
        <StaffLine />
      </View>
    </>
  );
}

/** Returning phone or signed-out account: no sales pitch, just the way back in. */
function Compact({ variant }: { variant: 'returning' | 'signedOut' }) {
  const router = useRouter();
  const { profile, startPassenger, startFresh } = useSession();
  const first = profile.name.trim().split(/\s+/)[0];

  async function browse() {
    await startPassenger();
    router.replace('/home');
  }

  const signedOut = variant === 'signedOut';
  return (
    <>
      <View style={styles.compact}>
        <BrandMark size={96} />
        <Text style={[styles.title, styles.center, { marginTop: space.xl }]} accessibilityRole="header">
          {signedOut ? 'You’re signed out' : first ? `Welcome back, ${first}` : 'Welcome back'}
        </Text>
        <Text style={[styles.body, styles.center]}>
          {signedOut
            ? 'Sign in to see your trips and boarding passes, or keep browsing departures without an account.'
            : 'Pick up where you left off: your trips, boarding passes and alerts are waiting.'}
        </Text>
      </View>

      <View style={styles.actions}>
        {signedOut ? (
          <>
            <Primary title="Sign in" onPress={() => router.push('/auth?next=/onboarding')} />
            <Secondary title="Browse without an account" onPress={browse} />
          </>
        ) : (
          <>
            <Primary title={first ? `Continue as ${first}` : 'Continue'} onPress={browse} />
            <Secondary title={first ? `Not ${first}? Start fresh` : 'Start fresh'} onPress={startFresh} />
          </>
        )}
        <StaffLine />
      </View>
    </>
  );
}

function Primary({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.primary, pressed && { opacity: 0.9 }]}>
      <Text style={styles.primaryText}>{title}</Text>
      <Ionicons name="arrow-forward" size={20} color={colors.forest900} />
    </Pressable>
  );
}

function Secondary({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.secondary, pressed && { opacity: 0.8 }]}>
      <Text style={styles.secondaryText}>{title}</Text>
    </Pressable>
  );
}

function StaffLine() {
  const router = useRouter();
  if (APP_VARIANT === 'combined') {
    return (
      <Pressable onPress={() => router.push('/staff-signin')} accessibilityRole="button" style={styles.staffLink}>
        <Ionicons name="briefcase-outline" size={16} color={colors.onDarkSoft} />
        <Text style={styles.staffText}>Crew or operations? Sign in to your workspace</Text>
      </Pressable>
    );
  }
  // The passenger app is passengers only; crews use the separate ToGo Staff app.
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.forest900 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 20, height: 52 },
  brand: { color: colors.white, fontWeight: '900', fontSize: 20, letterSpacing: -0.3 },
  previewTag: { backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  previewText: { color: colors.white, fontSize: 12, fontWeight: '700' },

  slide: { paddingHorizontal: 28, justifyContent: 'center' },
  art: { height: 230, alignItems: 'center', justifyContent: 'center', marginBottom: space.xl },
  ring3: { position: 'absolute', width: 220, height: 220, borderRadius: 110, backgroundColor: 'rgba(19,168,92,0.10)' },
  ring2: { position: 'absolute', width: 164, height: 164, borderRadius: 82, backgroundColor: 'rgba(19,168,92,0.22)' },
  iconCircle: { width: 112, height: 112, borderRadius: 56, backgroundColor: colors.live, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.white, fontSize: 30, fontWeight: '800', letterSpacing: -0.6, lineHeight: 36 },
  body: { color: colors.onDarkSoft, fontSize: font.body, lineHeight: 25, marginTop: space.md },
  center: { textAlign: 'center' },
  slides: { flex: 1 },
  compact: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

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

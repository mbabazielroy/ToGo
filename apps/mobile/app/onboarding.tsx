import { useEffect, useState } from 'react';
import { View, Text, TextInput, Switch, StyleSheet, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, Redirect } from 'expo-router';
import { APP_VARIANT } from '@/env';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NavBar, Group, Separator, SectionHeading, PrimaryButton, Segmented, Banner } from '@/components/ui';
import { useAppMode } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession, type PassengerProfile } from '@/session/SessionProvider';
import { useSearch } from '@/state/search';
import { Splash } from '@/session/SpaceGate';
import { haptics } from '@/lib/feedback';
import { phoneLooksValid, PHONE_HINT } from '@/lib/validate';
import { colors, space, font, SCREEN, control } from '@/theme';

/** Passenger setup: where you usually travel from, which alerts you want and,
 *  optionally, your name. Nothing personal is required to browse (App Store 5.1.1):
 *  the lead passenger's name is asked for when you reserve. Signed-in accounts that
 *  already have a name skip this screen. Everything can be changed later in Account. */
export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const mode = useAppMode();
  const { session, profile: authProfile } = useAuth();
  const { profile, startPassenger } = useSession();
  const { set } = useSearch();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [homeCity, setHomeCity] = useState<PassengerProfile['homeCity']>(profile.homeCity);
  const [notifyDelays, setNotifyDelays] = useState(profile.notifyDelays);
  const [notifyBoarding, setNotifyBoarding] = useState(profile.notifyBoarding);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signed-in (connected) users: prefill from their account profile.
  useEffect(() => {
    if (authProfile?.full_name && !name) setName(authProfile.full_name);
    if (authProfile?.phone && !phone) setPhone(authProfile.phone);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authProfile?.full_name, authProfile?.phone]);

  // An account that already has a name doesn't need to fill this in again.
  const accountName = authProfile?.full_name?.trim() ?? '';
  const skip = mode === 'connected' && !!session && !!accountName && accountName !== 'Traveller';
  useEffect(() => {
    if (!skip || APP_VARIANT === 'staff') return;
    (async () => {
      await startPassenger({ name: accountName, phone: authProfile?.phone ?? '' });
      set({ direction: profile.homeCity === 'Kampala' ? 'KLA_MBR' : 'MBR_KLA', hubId: null });
      router.replace('/home');
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [skip]);

  if (APP_VARIANT === 'staff') return <Redirect href="/staff-signin" />;
  if (skip) return <Splash />;
  const phoneOk = phoneLooksValid(phone);

  async function finish() {
    if (!phoneOk) { setError(PHONE_HINT); return; }
    setError(null); setBusy(true);
    await startPassenger({ name: name.trim(), phone: phone.trim(), homeCity, notifyDelays, notifyBoarding });
    set({ direction: homeCity === 'Kampala' ? 'KLA_MBR' : 'MBR_KLA', hubId: null });
    haptics.success();
    router.replace('/home');
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <NavBar title="" onBack={() => router.back()} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: SCREEN, paddingBottom: space.xxl }} keyboardShouldPersistTaps="handled">
          <Text style={styles.title} accessibilityRole="header">Set up your travel profile</Text>
          <Text style={styles.lead}>Tell us where you travel from and which alerts you want. You can start browsing straight away.</Text>

          <SectionHeading title="You usually travel from" />
          <Segmented
            segments={[{ value: 'Kampala', label: 'Kampala' }, { value: 'Mbarara', label: 'Mbarara' }]}
            value={homeCity}
            onChange={(v) => { haptics.select(); setHomeCity(v); }}
            accessibilityLabel="Home city"
          />

          <SectionHeading title="Alerts" />
          <Group>
            <ToggleRow label="Delays and changes" hint="When your bus sets off, or if it’s late, rescheduled or cancelled." value={notifyDelays} onChange={setNotifyDelays} />
            <Separator inset={SCREEN} />
            <ToggleRow label="Boarding reminders" hint="A reminder on your phone when check-in opens and when it's time to head to your hub." value={notifyBoarding} onChange={setNotifyBoarding} />
          </Group>

          <SectionHeading title="About you" />
          <Group>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Your name <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Aisha Namuli" placeholderTextColor={colors.faint}
                autoCapitalize="words" textContentType="name" autoComplete="name" accessibilityLabel="Your name, optional" returnKeyType="next" />
            </View>
            <Separator inset={SCREEN} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mobile number <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 700 123456" placeholderTextColor={colors.faint}
                keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" accessibilityLabel="Mobile number, optional" />
            </View>
          </Group>
          <Text style={styles.hint}>Saves typing when you reserve; the conductor sees the lead passenger's name. Your number isn't shown on passenger lists.</Text>

          {mode === 'connected' && !session && (
            <View style={{ marginTop: space.lg }}>
              <Banner tone="info" title="You can browse without an account">
                You'll be asked to sign in or create a free account when you reserve your first seat.
              </Banner>
            </View>
          )}
          {error && <View style={{ marginTop: space.lg }}><Banner tone="error">{error}</Banner></View>}
          <Text style={styles.agree}>
            By continuing you agree to the{' '}
            <Text style={styles.link} onPress={() => router.push('/legal?doc=terms')} accessibilityRole="link">Terms of use</Text> and{' '}
            <Text style={styles.link} onPress={() => router.push('/legal?doc=privacy')} accessibilityRole="link">Privacy policy</Text>.
          </Text>
        </ScrollView>
        <View style={[styles.footer, { paddingBottom: insets.bottom + space.md }]}>
          <PrimaryButton title="Start travelling" icon="arrow-forward" onPress={finish} loading={busy} />
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function ToggleRow({ label, hint, value, onChange }: { label: string; hint: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        <Text style={styles.toggleHint}>{hint}</Text>
      </View>
      <Switch value={value} onValueChange={(v) => { haptics.select(); onChange(v); }} trackColor={{ true: colors.forest600, false: colors.surfaceAlt }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 30, fontWeight: '800', color: colors.ink, letterSpacing: -0.6 },
  lead: { fontSize: font.body, color: colors.inkSoft, marginTop: space.sm, lineHeight: 24 },
  field: { paddingHorizontal: SCREEN, paddingTop: 10, paddingBottom: 4 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  optional: { fontWeight: '400' },
  input: { fontSize: font.body, color: colors.ink, paddingVertical: 8, minHeight: control.small },
  hint: { fontSize: font.tiny, color: colors.muted, marginTop: space.xs, paddingHorizontal: space.xs, lineHeight: 17 },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: 12 },
  toggleLabel: { fontSize: font.body, color: colors.ink, fontWeight: '500' },
  toggleHint: { fontSize: font.tiny, color: colors.muted, marginTop: 2 },
  agree: { fontSize: font.tiny, color: colors.muted, lineHeight: 17, marginTop: space.lg, textAlign: 'center' },
  link: { color: colors.forest700, fontWeight: '600' },
  footer: { paddingHorizontal: SCREEN, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
});

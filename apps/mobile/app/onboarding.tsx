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
import { haptics } from '@/lib/feedback';
import { colors, space, font, SCREEN, control } from '@/theme';

/** Passenger setup: who you are, where you usually travel from, and which alerts you
 *  want. Everything is optional except a name, and can be changed later in Account. */
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

  if (APP_VARIANT === 'staff') return <Redirect href="/staff-signin" />;
  const phoneOk = !phone.trim() || /^\+?[0-9 ]{9,15}$/.test(phone.trim());

  async function finish() {
    if (!name.trim()) { setError('Add your name so crew can find you on the passenger list.'); return; }
    if (!phoneOk) { setError('That phone number looks incomplete. Use a format like +256 700 123456.'); return; }
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
          <Text style={styles.lead}>We use this to fill in your reservations and send the alerts you choose.</Text>

          <SectionHeading title="About you" />
          <Group>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Full name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="e.g. Aisha Namuli" placeholderTextColor={colors.faint}
                autoCapitalize="words" textContentType="name" autoComplete="name" accessibilityLabel="Full name" returnKeyType="next" />
            </View>
            <Separator inset={SCREEN} />
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>Mobile number <Text style={styles.optional}>(optional)</Text></Text>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 700 123456" placeholderTextColor={colors.faint}
                keyboardType="phone-pad" textContentType="telephoneNumber" autoComplete="tel" accessibilityLabel="Mobile number, optional" />
            </View>
          </Group>
          <Text style={styles.hint}>Saved to your profile so it's filled in when you book. It isn't shown on passenger lists.</Text>

          <SectionHeading title="You usually travel from" />
          <Segmented
            segments={[{ value: 'Kampala', label: 'Kampala' }, { value: 'Mbarara', label: 'Mbarara' }]}
            value={homeCity}
            onChange={(v) => { haptics.select(); setHomeCity(v); }}
            accessibilityLabel="Home city"
          />

          <SectionHeading title="In-app alerts" />
          <Group>
            <ToggleRow label="Delays and changes" hint="If your bus is late, rescheduled or cancelled." value={notifyDelays} onChange={setNotifyDelays} />
            <Separator inset={SCREEN} />
            <ToggleRow label="Boarding reminders" hint="When it's time to head to your hub and when your bus arrives." value={notifyBoarding} onChange={setNotifyBoarding} />
          </Group>

          {mode === 'connected' && !session && (
            <View style={{ marginTop: space.lg }}>
              <Banner tone="info" title="You can browse without an account">
                You'll be asked to sign in or create a free account when you reserve your first seat.
              </Banner>
            </View>
          )}
          {error && <View style={{ marginTop: space.lg }}><Banner tone="error">{error}</Banner></View>}
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
  footer: { paddingHorizontal: SCREEN, paddingTop: space.md, backgroundColor: colors.surface, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
});

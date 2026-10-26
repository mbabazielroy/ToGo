import { useEffect, useState } from 'react';
import { View, Text, TextInput, StyleSheet, Switch, Pressable, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Group, Separator, SectionHeading, PrimaryButton, ListRow, Avatar, Segmented, Banner } from '@/components/ui';
import { useAppMode, useResetDemo } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { useSession, type PassengerProfile } from '@/session/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { SUPPORT_EMAIL } from '@/env';
import { humanError } from '@/hooks/useAsync';
import { haptics } from '@/lib/feedback';
import { colors, space, font, SCREEN, control, radius } from '@/theme';
import { ask } from '@/lib/dialog';

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I pay?', a: 'You pay the conductor when you board, using whatever the operator accepts. The app never asks for card details.' },
  { q: 'Can I cancel?', a: 'Yes. Open the trip in My trips and tap Cancel reservation any time before you board. Your seats are released straight away.' },
  { q: 'What if my bus is late?', a: 'You will see a delay on Home and on your boarding pass, and get an alert if you turned on delay notifications.' },
  { q: 'When should I get to the hub?', a: 'Aim to arrive 15 minutes before your pickup time and check in. The bus may not wait for late passengers.' },
];

export default function Account() {
  const mode = useAppMode();
  const resetDemo = useResetDemo();
  const toast = useToast();
  const router = useRouter();
  const { session, user, updatePassword } = useAuth();
  const { profile, updateProfile, signOut, available } = useSession();

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [homeCity, setHomeCity] = useState<PassengerProfile['homeCity']>(profile.homeCity);
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState<null | 'pw' | 'profile'>(null);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => { setName(profile.name); setPhone(profile.phone); setHomeCity(profile.homeCity); }, [profile.name, profile.phone, profile.homeCity]);

  const dirty = name.trim() !== profile.name || phone.trim() !== profile.phone || homeCity !== profile.homeCity;
  const connectedSignedOut = mode === 'connected' && !session;
  const staffSpaces = available.length;

  async function saveProfile() {
    if (!name.trim()) { toast('Your name can’t be empty.', 'error'); return; }
    setBusy('profile');
    try { await updateProfile({ name: name.trim(), phone: phone.trim(), homeCity }); haptics.success(); toast('Profile saved.', 'ok'); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(null); }
  }
  async function changePassword() {
    if (pw.length < 8) { toast('Use at least 8 characters.', 'error'); return; }
    setBusy('pw');
    try { await updatePassword(pw); toast('Password updated.', 'ok'); setPw(''); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(null); }
  }
  function confirmSignOut() {
    ask('Sign out?', mode === 'connected' ? 'You’ll need to sign in again to see your trips.' : 'You’ll return to the welcome screen. Preview data stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace('/welcome'); } },
    ]);
  }
  function confirmReset() {
    ask('Reset preview data?', 'Clears every preview booking, crew action and edit on this device and restores the seed network.', [
      { text: 'Keep data', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetDemo(); toast('Preview reset.', 'ok'); } },
    ]);
  }

  return (
    <Screen showHeader={false}>
      <View style={styles.header}>
        <Avatar name={profile.name || 'Traveller'} size={56} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1}>{profile.name || 'Traveller'}</Text>
          <Text style={styles.sub} numberOfLines={1}>
            {mode === 'connected' ? (user?.email ?? 'Not signed in') : 'Preview passenger'}{profile.homeCity ? ` · ${profile.homeCity}` : ''}
          </Text>
        </View>
      </View>

      {connectedSignedOut && (
        <View style={{ gap: space.sm }}>
          <Banner tone="info" title="Sign in to sync your trips">Reservations and boarding passes are tied to your account so they’re safe on any phone.</Banner>
          <PrimaryButton title="Sign in or create account" icon="log-in-outline" onPress={() => router.push('/auth?next=/account')} />
        </View>
      )}

      <View>
        <SectionHeading title="Profile" />
        <Group>
          <Field label="Full name"><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={colors.faint} autoCapitalize="words" accessibilityLabel="Full name" /></Field>
          <Separator inset={SCREEN} />
          <Field label="Mobile number"><TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 700 123456" keyboardType="phone-pad" placeholderTextColor={colors.faint} accessibilityLabel="Mobile number" /></Field>
          <Separator inset={SCREEN} />
          <View style={{ padding: SCREEN, gap: 8 }}>
            <Text style={styles.fieldLabel}>Home city</Text>
            <Segmented segments={[{ value: 'Kampala', label: 'Kampala' }, { value: 'Mbarara', label: 'Mbarara' }]} value={homeCity} onChange={setHomeCity} accessibilityLabel="Home city" />
          </View>
        </Group>
        {dirty && <View style={{ marginTop: space.sm }}><PrimaryButton title="Save changes" onPress={saveProfile} loading={busy === 'profile'} /></View>}
      </View>

      <View>
        <SectionHeading title="In-app alerts" />
        <Group>
          <Toggle label="Delays and changes" value={profile.notifyDelays} onChange={(v) => updateProfile({ notifyDelays: v })} />
          <Separator inset={SCREEN} />
          <Toggle label="Boarding reminders" value={profile.notifyBoarding} onChange={(v) => updateProfile({ notifyBoarding: v })} />
        </Group>
      </View>

      {mode === 'connected' && session && (
        <View>
          <SectionHeading title="Security" />
          <Group>
            <Field label="New password"><TextInput style={styles.input} secureTextEntry value={pw} onChangeText={setPw} placeholder="At least 8 characters" placeholderTextColor={colors.faint} textContentType="newPassword" accessibilityLabel="New password" /></Field>
          </Group>
          {pw.length > 0 && <View style={{ marginTop: space.sm }}><PrimaryButton title="Update password" onPress={changePassword} loading={busy === 'pw'} /></View>}
        </View>
      )}

      <View>
        <SectionHeading title="Help" />
        <Group>
          {FAQ.map((f, i) => (
            <View key={f.q}>
              {i > 0 && <Separator inset={SCREEN} />}
              <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={styles.faqRow}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
              </Pressable>
              {open === i && <Text style={styles.faqA}>{f.a}</Text>}
            </View>
          ))}
          <Separator inset={SCREEN} />
          {SUPPORT_EMAIL ? (
            <ListRow icon="chatbubble-ellipses-outline" title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=ToGo%20help`).catch(() => toast('No email app found.', 'error'))} />
          ) : (
            <ListRow icon="chatbubble-ellipses-outline" title="Need a hand?" subtitle="Ask the attendant at your hub or your conductor — they can see your reservation." />
          )}
        </Group>
      </View>

      <View>
        <SectionHeading title="Work with ToGo" />
        <Group>
          <ListRow icon="briefcase-outline" title="Staff workspace" subtitle={staffSpaces > 0 ? `Drivers, conductors, hub attendants and operations${mode === 'demo' ? ' (preview personas)' : ''}` : 'Sign in with a staff account'} onPress={() => router.push('/staff-signin')} />
        </Group>
      </View>

      {mode === 'demo' && (
        <View>
          <SectionHeading title="Preview" />
          <Group>
            <ListRow icon="refresh" iconColor={colors.amber600} title="Reset preview data" subtitle="Restore the seed network and clear bookings on this device" onPress={confirmReset} />
          </Group>
        </View>
      )}

      <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
        <Text style={styles.signOutText}>Sign out</Text>
      </Pressable>

      <Text style={styles.about}>
        ToGo {Constants.expoConfig?.version ?? ''} · Kampala ⇄ Mbarara pilot. You pay the operator at boarding; ToGo never collects payment in the app.
      </Text>
    </Screen>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ paddingHorizontal: SCREEN, paddingTop: 10, paddingBottom: 2 }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={styles.toggle}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={(v) => { haptics.select(); onChange(v); }} trackColor={{ true: colors.forest600, false: colors.surfaceAlt }} accessibilityLabel={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  name: { fontSize: font.h2, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  input: { fontSize: font.body, color: colors.ink, paddingVertical: 8, minHeight: control.small },
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SCREEN, minHeight: control.height },
  toggleLabel: { fontSize: font.body, color: colors.ink },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, minHeight: control.height },
  faqQ: { flex: 1, fontSize: font.body, color: colors.ink },
  faqA: { fontSize: font.small, color: colors.inkSoft, lineHeight: 21, paddingHorizontal: SCREEN, paddingBottom: space.md },
  signOut: { backgroundColor: colors.surface, borderRadius: radius.lg, minHeight: control.height, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  signOutText: { color: colors.red700, fontWeight: '600', fontSize: font.body },
  about: { color: colors.muted, fontSize: font.tiny, textAlign: 'center', lineHeight: 17, paddingHorizontal: space.lg },
});

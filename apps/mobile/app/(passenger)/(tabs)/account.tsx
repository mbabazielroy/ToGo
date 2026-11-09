import { useEffect, useRef, useState } from 'react';
import { View, Text, Switch, Pressable, Linking, type TextInputInstance } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Group, Separator, SectionHeading, PrimaryButton, ListRow, Avatar, Segmented, Banner, GhostButton } from '@/components/ui';
import { TextField } from '@/components/TextField';
import { useAppMode, useResetDemo } from '@/data/AdapterProvider';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor, useSession, type PassengerProfile } from '@/session/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { SUPPORT_EMAIL, APP_VARIANT } from '@/env';
import { humanError } from '@/hooks/useAsync';
import { AccountSecurity } from '@/auth/AccountSecurity';
import { AppearanceSetting } from '@/appearance/AppearanceSetting';
import { useNotificationPermission } from '@/notifications/useNotificationPermission';
import { haptics } from '@/lib/feedback';
import { phoneLooksValid, PHONE_HINT } from '@/lib/validate';
import { space, font, SCREEN, control, radius, useColors, makeStyles } from '@/theme';
import { ask } from '@/lib/dialog';

const NAME_MAX = 80;

const FAQ: { q: string; a: string }[] = [
  { q: 'How do I pay?', a: 'You pay the conductor when you board, using whatever the operator accepts. The app never asks for card details.' },
  { q: 'Can I cancel?', a: 'Yes. Open the trip in My trips and tap Cancel reservation any time before you board. Your seats are released straight away.' },
  { q: 'What if my bus is late?', a: 'You will see a delay on Home and on your boarding pass, and get an alert if you turned on delay notifications.' },
  { q: 'When should I get to the hub?', a: 'Aim to arrive 15 minutes before your pickup time and check in. Check-in opens 2 hours before pickup, and the bus may not wait for late passengers.' },
];

function nameProblem(name: string): string | null {
  if (name.trim().length > NAME_MAX) return `Use at most ${NAME_MAX} characters.`;
  return null;
}

export default function Account() {
  const styles = useStyles();
  const colors = useColors();
  const mode = useAppMode();
  const resetDemo = useResetDemo();
  const toast = useToast();
  const router = useRouter();
  const { session, user } = useAuth();
  const { profile, updateProfile, signOut, deleteAccount, available } = useSession();
  const notif = useNotificationPermission();
  const phoneRef = useRef<TextInputInstance>(null);

  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [homeCity, setHomeCity] = useState<PassengerProfile['homeCity']>(profile.homeCity);
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState<null | 'profile' | 'delete'>(null);
  const [open, setOpen] = useState<number | null>(null);

  const resetForm = () => { setName(profile.name); setPhone(profile.phone); setHomeCity(profile.homeCity); setTried(false); };
  useEffect(resetForm, [profile.name, profile.phone, profile.homeCity]);

  const dirty = name.trim() !== profile.name || phone.trim() !== profile.phone || homeCity !== profile.homeCity;
  const signedIn = mode === 'demo' || !!session;
  const connectedSignedOut = mode === 'connected' && !session;
  const staffSpaces = available.length;
  const nameError = tried ? nameProblem(name) : null;
  const phoneError = tried && !phoneLooksValid(phone) ? PHONE_HINT : null;
  const alertsOn = profile.notifyDelays || profile.notifyBoarding;

  async function saveProfile() {
    setTried(true);
    if (nameProblem(name) || !phoneLooksValid(phone)) { haptics.warning(); return; }
    setBusy('profile');
    try {
      await updateProfile({ name: name.trim(), phone: phone.trim(), homeCity });
      haptics.success();
      toast('Profile saved.', 'ok');
      setTried(false);
    } catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(null); }
  }

  async function setAlert(key: 'notifyDelays' | 'notifyBoarding', on: boolean) {
    haptics.select();
    if (on && notif.status !== 'granted' && notif.status !== 'unavailable') {
      // Turning an alert on is the moment to ask, not on first launch.
      await notif.request();
    }
    updateProfile({ [key]: on }).catch((e) => toast(humanError(e), 'error'));
  }

  function confirmSignOut() {
    ask('Sign out?', mode === 'connected' ? 'You’ll need to sign in again to see your trips. Boarding passes saved on this phone are removed.' : 'You’ll return to the welcome screen. Preview data stays on this device.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => { await signOut(); router.replace(homeFor(null)); } },
    ]);
  }
  function confirmDelete() {
    const connectedAccount = mode === 'connected' && !!session;
    ask('Delete your account?', connectedAccount
      ? 'This permanently deletes your ToGo account, profile, reservations and alerts. Upcoming seats are released. This can’t be undone.'
      : 'This removes your profile, reservations and alerts from this device. This can’t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete account', style: 'destructive', onPress: async () => {
        setBusy('delete');
        try {
          await deleteAccount();
          if (mode === 'demo') await resetDemo();
          haptics.success();
          toast('Your account was deleted.', 'ok');
          router.replace(homeFor(null));
        } catch (e) { toast(humanError(e), 'error'); }
        finally { setBusy(null); }
      } },
    ]);
  }
  function confirmReset() {
    ask('Reset preview data?', 'Clears every preview booking, crew action and edit on this device and restores the seed network.', [
      { text: 'Keep data', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetDemo(); toast('Preview reset.', 'ok'); } },
    ]);
  }
  function emailSupport(subject: string, body = '') {
    const url = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
    Linking.openURL(url).catch(() => toast(`No email app found. Write to ${SUPPORT_EMAIL}.`, 'error'));
  }

  const displayName = profile.name || 'Traveller';
  const subtitle = mode === 'connected' ? (user?.email ?? 'Not signed in') : 'Preview passenger';

  return (
    <Screen showHeader={false}>
      <View style={styles.header} accessible accessibilityLabel={`${displayName}, ${subtitle}`}>
        <Avatar name={displayName} size={64} />
        <View style={{ flex: 1 }}>
          <Text style={styles.name} numberOfLines={1} accessibilityRole="header">{displayName}</Text>
          <Text style={styles.sub} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>

      {connectedSignedOut && (
        <View style={{ gap: space.sm }}>
          <Banner tone="info" title="Sign in to sync your trips">Reservations and boarding passes are tied to your account so they’re safe on any phone.</Banner>
          <PrimaryButton title="Sign in or create account" icon="log-in-outline" onPress={() => router.push('/auth?next=/account')} />
        </View>
      )}

      <View>
        <SectionHeading title="Personal details" />
        <Group>
          <TextField
            bare label="Your name (optional)" value={name} onChangeText={setName} error={nameError}
            hint="Filled in for you when you reserve. The conductor sees it on the passenger list." placeholder="e.g. Aisha Namuli" autoCapitalize="words" autoComplete="name" textContentType="name"
            maxLength={NAME_MAX + 20} returnKeyType="next" onSubmitEditing={() => phoneRef.current?.focus()} submitBehavior="submit"
          />
          <Separator inset={SCREEN} />
          <TextField
            ref={phoneRef} bare label="Mobile number (optional)" value={phone} onChangeText={setPhone} error={phoneError}
            hint="The conductor or hub can call you if the bus changes." placeholder="+256 700 123456"
            keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" maxLength={22}
          />
          <Separator inset={SCREEN} />
          <View style={styles.cityRow}>
            <Text style={styles.fieldLabel}>Home city</Text>
            <Segmented segments={[{ value: 'Kampala', label: 'Kampala' }, { value: 'Mbarara', label: 'Mbarara' }]} value={homeCity} onChange={setHomeCity} accessibilityLabel="Home city" />
            <Text style={styles.fieldHint}>Used to suggest your usual direction on Go.</Text>
          </View>
        </Group>
        {dirty && (
          <View style={styles.saveRow}>
            <View style={{ flex: 1 }}><GhostButton title="Discard" onPress={resetForm} /></View>
            <View style={{ flex: 2 }}><PrimaryButton title="Save changes" onPress={saveProfile} loading={busy === 'profile'} /></View>
          </View>
        )}
      </View>

      <View>
        <SectionHeading title="Notifications" />
        {alertsOn && notif.status === 'denied' && (
          <View style={{ marginBottom: space.sm }}>
            <Banner tone="warn" title="Notifications are off for ToGo">Turn them on in your phone’s settings to get delay and boarding alerts.</Banner>
          </View>
        )}
        <Group>
          <Toggle label="Delays and changes" detail="If your bus is late, rerouted or cancelled" value={profile.notifyDelays} onChange={(v) => setAlert('notifyDelays', v)} />
          <Separator inset={SCREEN} />
          <Toggle label="Boarding reminders" detail="Before pickup, and when your bus is on its way" value={profile.notifyBoarding} onChange={(v) => setAlert('notifyBoarding', v)} />
          {notif.status === 'denied' && (
            <>
              <Separator inset={SCREEN + 44} />
              <ListRow icon="settings-outline" title="Open phone settings" onPress={notif.openSettings} />
            </>
          )}
        </Group>
      </View>

      <AppearanceSetting />

      {mode === 'connected' && session && <AccountSecurity name={profile.name} />}

      <View>
        <SectionHeading title="Help" />
        <Group>
          {FAQ.map((f, i) => (
            <View key={f.q}>
              {i > 0 && <Separator inset={SCREEN} />}
              <Pressable onPress={() => setOpen(open === i ? null : i)} accessibilityRole="button" accessibilityState={{ expanded: open === i }} style={({ pressed }) => [styles.faqRow, pressed && { backgroundColor: colors.forest50 }]}>
                <Text style={styles.faqQ}>{f.q}</Text>
                <Ionicons name={open === i ? 'chevron-up' : 'chevron-down'} size={16} color={colors.muted} />
              </Pressable>
              {open === i && <Text style={styles.faqA}>{f.a}</Text>}
            </View>
          ))}
          <Separator inset={SCREEN} />
          {SUPPORT_EMAIL ? (
            <ListRow icon="chatbubble-ellipses-outline" title="Contact support" subtitle={SUPPORT_EMAIL} onPress={() => emailSupport('ToGo help')} />
          ) : (
            <ListRow icon="chatbubble-ellipses-outline" title="Need a hand?" subtitle="Ask the attendant at your hub or your conductor — they can see your reservation." />
          )}
        </Group>
      </View>

      {APP_VARIANT === 'combined' && (
        <View>
          <SectionHeading title="Work with ToGo" />
          <Group>
            <ListRow icon="briefcase-outline" title="Staff workspace" subtitle={staffSpaces > 0 ? `Drivers, conductors, hub attendants and operations${mode === 'demo' ? ' (preview personas)' : ''}` : 'Sign in with a staff account'} onPress={() => router.push('/staff-signin')} />
          </Group>
        </View>
      )}

      {mode === 'demo' && (
        <View>
          <SectionHeading title="Preview" />
          <Group>
            <ListRow icon="refresh" iconColor={colors.amber600} title="Reset preview data" subtitle="Restore the seed network and clear bookings on this device" onPress={confirmReset} />
          </Group>
        </View>
      )}

      <View>
        <SectionHeading title="Privacy and legal" />
        <Group>
          <ListRow icon="shield-checkmark-outline" title="Privacy policy" onPress={() => router.push('/legal?doc=privacy')} />
          <Separator inset={SCREEN + 44} />
          <ListRow icon="document-text-outline" title="Terms of use" onPress={() => router.push('/legal?doc=terms')} />
          {SUPPORT_EMAIL && mode === 'connected' && session ? (
            <>
              <Separator inset={SCREEN + 44} />
              <ListRow
                icon="download-outline" title="Get a copy of your data" subtitle="We’ll email it to you within 30 days"
                onPress={() => emailSupport('Copy of my ToGo data', `Please send me a copy of the personal data ToGo holds for the account ${user?.email ?? ''}.`)}
              />
            </>
          ) : null}
        </Group>
      </View>

      {signedIn && (
        <View style={{ gap: space.xs }}>
          <Pressable onPress={confirmSignOut} accessibilityRole="button" style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
            <Text style={styles.signOutText}>Sign out</Text>
          </Pressable>
          <Pressable onPress={confirmDelete} disabled={busy === 'delete'} accessibilityRole="button" accessibilityHint="Permanently deletes your account" style={({ pressed }) => [styles.deleteBtn, pressed && { opacity: 0.7 }]}>
            <Text style={styles.deleteText}>{busy === 'delete' ? 'Deleting…' : 'Delete account'}</Text>
          </Pressable>
        </View>
      )}

      <Text style={styles.about}>
        ToGo {Constants.expoConfig?.version ?? ''} · Kampala ⇄ Mbarara. You pay the operator at boarding; ToGo never collects payment in the app.
      </Text>
    </Screen>
  );
}

function Toggle({ label, detail, value, onChange }: { label: string; detail?: string; value: boolean; onChange: (v: boolean) => void }) {
  const styles = useStyles();
  const colors = useColors();
  return (
    <Pressable onPress={() => onChange(!value)} accessibilityRole="switch" accessibilityState={{ checked: value }} accessibilityLabel={label} accessibilityHint={detail} style={styles.toggle}>
      <View style={{ flex: 1 }}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {detail ? <Text style={styles.toggleDetail}>{detail}</Text> : null}
      </View>
      <Switch
        value={value} onValueChange={onChange}
        trackColor={{ true: colors.forest600, false: colors.surfaceAlt }}
        importantForAccessibility="no-hide-descendants" accessibilityElementsHidden
      />
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingTop: space.md },
  name: { fontSize: font.h2, fontWeight: '800', color: colors.ink, letterSpacing: -0.3 },
  sub: { fontSize: font.small, color: colors.muted, marginTop: 2 },
  fieldLabel: { fontSize: font.tiny, color: colors.muted, fontWeight: '600' },
  fieldHint: { fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
  cityRow: { padding: SCREEN, gap: 8 },
  saveRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.sm },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: SCREEN, paddingVertical: 10, minHeight: control.height },
  toggleLabel: { fontSize: font.body, color: colors.ink },
  toggleDetail: { fontSize: font.tiny, color: colors.muted, marginTop: 2, lineHeight: 17 },
  faqRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: SCREEN, minHeight: control.height },
  faqQ: { flex: 1, fontSize: font.body, color: colors.ink },
  faqA: { fontSize: font.small, color: colors.inkSoft, lineHeight: 21, paddingHorizontal: SCREEN, paddingBottom: space.md },
  signOut: { backgroundColor: colors.surface, borderRadius: radius.lg, minHeight: control.height, alignItems: 'center', justifyContent: 'center', marginTop: space.sm },
  signOutText: { color: colors.red700, fontWeight: '600', fontSize: font.body },
  deleteBtn: { minHeight: control.small, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.red700, fontSize: font.small, fontWeight: '500' },
  about: { color: colors.muted, fontSize: font.tiny, textAlign: 'center', lineHeight: 17, paddingHorizontal: space.lg },
}));

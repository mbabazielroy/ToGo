import { useState } from 'react';
import { View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { Group, Separator, SectionHeading, PrimaryButton, ListRow, Banner } from '@/components/ui';
import { PasswordField } from '@/components/PasswordField';
import { TextField } from '@/components/TextField';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor, useSession } from '@/session/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { ask } from '@/lib/dialog';
import { authErrorMessage, emailLooksValid, newPasswordProblem, normaliseEmail } from '@shared/lib/authRules';
import { space, font, SCREEN, makeStyles } from '@/theme';

type Panel = null | 'email' | 'password';

/** "Sign-in and security" on the passenger Account and crew profile screens
 *  (signed-in, connected accounts only): change the email or password (both need
 *  the current password), and sign out on every device. */
export function AccountSecurity({ name }: { name?: string }) {
  const styles = useStyles();
  const { user, changePassword, changeEmail } = useAuth();
  const { signOut } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [panel, setPanel] = useState<Panel>(null);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingEmail = (user as { new_email?: string } | null)?.new_email;

  function toggle(p: Panel) {
    setPanel((o) => (o === p ? null : p));
    setCurrent(''); setNext(''); setNewEmail(''); setEmailError(null);
  }

  async function savePassword() {
    if (!current) { toast('Enter your current password.', 'error'); return; }
    const problem = newPasswordProblem(next, { email: user?.email, name });
    if (problem) { toast(problem, 'error'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      haptics.success();
      toast('Password changed. Other devices were signed out.', 'ok');
      toggle(null);
    } catch (e) { toast(authErrorMessage(e), 'error'); }
    finally { setBusy(false); }
  }

  async function saveEmail() {
    const mail = normaliseEmail(newEmail);
    if (!emailLooksValid(mail)) { setEmailError('Enter a valid email address.'); return; }
    if (mail === normaliseEmail(user?.email ?? '')) { setEmailError('That’s already your email.'); return; }
    if (!current) { toast('Enter your current password.', 'error'); return; }
    setEmailError(null);
    setBusy(true);
    try {
      await changeEmail(mail, current, Linking.createURL('/account'));
      haptics.success();
      toast('Check both inboxes to confirm the change.', 'ok');
      toggle(null);
    } catch (e) {
      const code = (e as { code?: string }).code;
      if (code === 'email_exists' || code === 'user_already_exists') setEmailError('That email can’t be used. Try a different one.');
      else toast(authErrorMessage(e), 'error');
    } finally { setBusy(false); }
  }

  function confirmEverywhere() {
    ask('Sign out on all devices?', 'You’ll be signed out here and on every other phone or browser using this account, including the operations console.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out everywhere', style: 'destructive', onPress: async () => {
        try { await signOut(true); router.replace(homeFor(null)); }
        catch (e) { toast(authErrorMessage(e), 'error'); }
      } },
    ]);
  }

  return (
    <View>
      <SectionHeading title="Sign-in and security" />
      {pendingEmail ? (
        <View style={{ marginBottom: space.sm }}>
          <Banner tone="info" title="Email change waiting">
            {`Open the links we sent to ${user?.email} and ${pendingEmail} to finish. Until then, keep signing in with ${user?.email}.`}
          </Banner>
        </View>
      ) : null}
      <Group>
        <ListRow icon="mail-outline" title="Email" value={user?.email ?? ''} onPress={() => toggle('email')} />
        {panel === 'email' && (
          <View style={styles.form}>
            <TextField
              label="New email" value={newEmail} onChangeText={(v) => { setNewEmail(v); setEmailError(null); }}
              error={emailError} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
              autoComplete="email" textContentType="emailAddress" placeholder="you@example.com"
            />
            <PasswordField label="Current password" value={current} onChange={setCurrent} onSubmit={saveEmail} />
            <PrimaryButton title="Change email" onPress={saveEmail} loading={busy} />
            <Text style={styles.note}>We’ll email both addresses. The change happens once you’ve opened both links, so no one can move your account without access to your current inbox.</Text>
          </View>
        )}
        <Separator inset={SCREEN + 44} />
        <ListRow icon="key-outline" title="Password" value="Change" onPress={() => toggle('password')} />
        {panel === 'password' && (
          <View style={styles.form}>
            <PasswordField label="Current password" value={current} onChange={setCurrent} />
            <PasswordField label="New password" value={next} onChange={setNext} isNew context={{ email: user?.email, name }} onSubmit={savePassword} />
            <PrimaryButton title="Change password" onPress={savePassword} loading={busy} />
            <Text style={styles.note}>Changing it signs out your other devices. Forgotten it? Sign out, then tap “Forgot your password?”.</Text>
          </View>
        )}
        <Separator inset={SCREEN + 44} />
        <ListRow icon="phone-portrait-outline" title="Sign out on all devices" subtitle="If you lost a phone or signed in somewhere else" onPress={confirmEverywhere} />
      </Group>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  form: { paddingHorizontal: SCREEN, paddingVertical: space.md, gap: 12 },
  note: { fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
}));

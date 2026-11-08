import { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Group, Separator, SectionHeading, PrimaryButton, ListRow } from '@/components/ui';
import { PasswordField } from '@/components/PasswordField';
import { useAuth } from '@/auth/AuthProvider';
import { homeFor, useSession } from '@/session/SessionProvider';
import { useToast } from '@/components/ToastProvider';
import { haptics } from '@/lib/feedback';
import { ask } from '@/lib/dialog';
import { authErrorMessage, newPasswordProblem } from '@shared/lib/authRules';
import { colors, space, font, SCREEN } from '@/theme';

/** "Security" on the passenger Account and crew profile screens (signed-in,
 *  connected accounts only): change the password, which needs the current one and
 *  signs out other devices, and sign out on every device. */
export function AccountSecurity({ name }: { name?: string }) {
  const { user, changePassword } = useAuth();
  const { signOut } = useSession();
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!current) { toast('Enter your current password.', 'error'); return; }
    const problem = newPasswordProblem(next, { email: user?.email, name });
    if (problem) { toast(problem, 'error'); return; }
    setBusy(true);
    try {
      await changePassword(current, next);
      haptics.success();
      toast('Password changed. Other devices were signed out.', 'ok');
      setCurrent(''); setNext(''); setOpen(false);
    } catch (e) { toast(authErrorMessage(e), 'error'); }
    finally { setBusy(false); }
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
      <SectionHeading title="Security" />
      <Group>
        <ListRow icon="key-outline" title="Change password" onPress={() => setOpen((o) => !o)} />
        {open && (
          <View style={styles.form}>
            <PasswordField label="Current password" value={current} onChange={setCurrent} />
            <PasswordField label="New password" value={next} onChange={setNext} isNew context={{ email: user?.email, name }} onSubmit={save} />
            <PrimaryButton title="Change password" onPress={save} loading={busy} />
            <Text style={styles.note}>Changing it signs out your other devices. Forgotten it? Sign out, then tap “Forgot your password?”.</Text>
          </View>
        )}
        <Separator inset={SCREEN + 44} />
        <ListRow icon="phone-portrait-outline" title="Sign out on all devices" subtitle="If you lost a phone or signed in somewhere else" onPress={confirmEverywhere} />
      </Group>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { paddingHorizontal: SCREEN, paddingVertical: space.md, gap: 12 },
  note: { fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
});

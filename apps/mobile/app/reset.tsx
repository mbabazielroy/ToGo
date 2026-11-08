import { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { Card, PrimaryButton, ErrorRow } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { PasswordField } from '@/components/PasswordField';
import { authErrorMessage, newPasswordProblem } from '@shared/lib/authRules';
import { colors, radius, space, font } from '@/theme';

// Reached after a password-reset link opened on this phone sets recoveryMode (see
// useAuthDeepLinks), or when a reset code worked but the new password was refused.
// Without a recovery session the form explains the link is invalid or expired.
// Setting the password signs every other device out. The link path is unverified
// without a development build and the redirect URLs set up (docs/MOBILE.md).
export default function ResetScreen() {
  const { session, user, updatePassword, clearRecoveryMode } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    const problem = newPasswordProblem(pw, { email: user?.email });
    if (problem) { setErr(problem); return; }
    setErr(null); setBusy(true);
    try { await updatePassword(pw); toast('Password changed. Other devices were signed out.', 'ok'); router.replace('/'); }
    catch (e) { setErr(authErrorMessage(e)); setBusy(false); }
  }

  return (
    <Screen showHeader={false}>
      <View style={{ alignItems: 'center', marginTop: space.xxl, marginBottom: space.lg }}>
        <Text style={styles.title}>Set a new password</Text>
      </View>
      <Card style={{ gap: 12 }}>
        {!session && <View style={styles.warn}><Text style={styles.warnText}>This reset link has expired, was already used, or was opened on a different phone from the one that asked for it. On the sign-in screen, tap “Forgot your password?” and use the code from the new email instead: it works on any device.</Text></View>}
        <PasswordField label="New password" value={pw} onChange={setPw} isNew context={{ email: user?.email }} onSubmit={submit} />
        {err && <ErrorRow message={err} />}
        <PrimaryButton title="Update password" onPress={submit} loading={busy} disabled={!session} />
        <Pressable onPress={() => { clearRecoveryMode(); router.replace('/'); }} accessibilityRole="button" hitSlop={8}><Text style={styles.back}>Back to sign in</Text></Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: '700', color: colors.ink },
  warn: { backgroundColor: colors.amber100, borderRadius: radius.md, padding: space.md },
  warnText: { color: colors.amber800, fontSize: font.small },
  back: { textAlign: 'center', color: colors.forest500, fontWeight: '600', fontSize: font.small },
});

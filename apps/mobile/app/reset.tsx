import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { Card, Muted, PrimaryButton, ErrorRow } from '../src/components/ui';
import { useAuth } from '../src/auth/AuthProvider';
import { useToast } from '../src/components/ToastProvider';
import { humanError } from '../src/hooks/useAsync';
import { colors, radius, space, font } from '../src/theme';

// Reached after a password-recovery deep link sets recoveryMode (see
// useAuthDeepLinks). If there is no recovery session the form explains the link is
// invalid/expired. This path is UNVERIFIED without a dev build + configured redirect
// URLs (see docs/MOBILE.md).
export default function ResetScreen() {
  const { session, updatePassword, clearRecoveryMode } = useAuth();
  const router = useRouter();
  const toast = useToast();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    if (pw.length < 6) { setErr('Password must be at least 6 characters.'); return; }
    setErr(null); setBusy(true);
    try { await updatePassword(pw); toast('Password updated.', 'ok'); router.replace('/'); }
    catch (e) { setErr(humanError(e)); setBusy(false); }
  }

  return (
    <Screen showHeader={false}>
      <View style={{ alignItems: 'center', marginTop: space.xxl, marginBottom: space.lg }}>
        <Text style={styles.title}>Set a new password</Text>
      </View>
      <Card style={{ gap: 12 }}>
        {!session && <View style={styles.warn}><Text style={styles.warnText}>This reset link is invalid or has expired. Request a new one from the sign-in screen.</Text></View>}
        {err && <ErrorRow message={err} onRetry={submit} />}
        <View><Text style={styles.label}>New password</Text>
          <TextInput style={styles.input} value={pw} onChangeText={setPw} secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} accessibilityLabel="New password" /></View>
        <PrimaryButton title="Update password" onPress={submit} loading={busy} disabled={!session} />
        <Pressable onPress={() => { clearRecoveryMode(); router.replace('/'); }}><Text style={styles.back}>Back to sign in</Text></Pressable>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: font.h1, fontWeight: '800', color: colors.forest900 },
  label: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.forest600, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.white },
  warn: { backgroundColor: colors.amber100, borderRadius: radius.md, padding: space.md },
  warnText: { color: colors.amber800, fontSize: font.small },
  back: { textAlign: 'center', color: colors.forest500, fontWeight: '600', fontSize: font.small },
});

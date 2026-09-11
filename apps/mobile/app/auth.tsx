import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Card, Muted, PrimaryButton, ErrorRow } from '../src/components/ui';
import { useAuth } from '../src/auth/AuthProvider';
import { useToast } from '../src/components/ToastProvider';
import { humanError } from '../src/hooks/useAsync';
import { colors, radius, space, font } from '../src/theme';

type Tab = 'signin' | 'signup' | 'reset';

export default function AuthScreen() {
  const { signIn, signUp, resetPassword, session, recoveryMode } = useAuth();
  const toast = useToast();
  const router = useRouter();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const returnTo = (typeof next === 'string' && next.startsWith('/') ? next : '/') as Href;
  const [tab, setTab] = useState<Tab>('signin');

  // Once signed in, continue to the preserved journey (or Home). This keeps the
  // selected trip through sign-in without ever reserving before authentication.
  useEffect(() => {
    if (session && !recoveryMode) router.replace(returnTo);
  }, [session, recoveryMode, returnTo, router]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setErr(null); setBusy(true);
    try {
      if (tab === 'signin') {
        await signIn(email.trim(), password);
      } else if (tab === 'signup') {
        const redirect = Linking.createURL('/');
        const { needsConfirmation } = await signUp(email.trim(), password, fullName.trim() || 'Traveller', redirect);
        if (needsConfirmation) { toast('Check your email to confirm, then sign in.', 'ok'); setTab('signin'); }
      } else {
        const redirect = Linking.createURL('/reset');
        await resetPassword(email.trim(), redirect);
        toast('If that email exists, a reset link is on its way.', 'ok');
        setTab('signin');
      }
    } catch (e) { setErr(humanError(e)); }
    finally { setBusy(false); }
  }

  return (
    <Screen showHeader={false}>
      <Pressable onPress={() => router.replace('/')} accessibilityRole="button" accessibilityLabel="Continue browsing" style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.forest700} />
        <Text style={styles.backText}>Browse</Text>
      </Pressable>
      <View style={{ alignItems: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        <View style={styles.logo}><Text style={styles.logoText}>ToGo</Text></View>
        <Muted>{next ? 'Sign in to reserve your seat.' : 'Your bus. Your stop. — Connected pilot sign in.'}</Muted>
      </View>
      <Card style={{ gap: 12 }}>
        <View style={styles.tabs}>
          {(['signin', 'signup'] as const).map((k) => (
            <Pressable key={k} onPress={() => { setTab(k); setErr(null); }} style={[styles.tab, tab === k && styles.tabActive]}>
              <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>{k === 'signin' ? 'Sign in' : 'Create account'}</Text>
            </Pressable>
          ))}
        </View>

        {tab === 'signup' && (
          <View><Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Amina N." placeholderTextColor={colors.muted} /></View>
        )}
        <View><Text style={styles.label}>Email</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" placeholderTextColor={colors.muted} /></View>
        {tab !== 'reset' && (
          <View><Text style={styles.label}>Password</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry placeholderTextColor={colors.muted} /></View>
        )}

        {err && <ErrorRow message={err} onRetry={submit} />}
        <PrimaryButton
          title={tab === 'signin' ? 'Sign in' : tab === 'signup' ? 'Create passenger account' : 'Send reset link'}
          onPress={submit} loading={busy}
        />
        {tab === 'signin' && <Pressable onPress={() => { setTab('reset'); setErr(null); }}><Text style={styles.forgot}>Forgot your password?</Text></Pressable>}
        {tab === 'signup' && <Muted style={{ textAlign: 'center', fontSize: font.tiny }}>Public signup creates a passenger account only. Staff access is granted by an administrator.</Muted>}
      </Card>
      <Muted style={{ textAlign: 'center', fontSize: font.tiny, marginTop: space.md }}>
        Connected pilot · Real accounts and shared data. Illustrative service — not a real transport launch.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.forest700, fontWeight: '600', fontSize: font.body },
  logo: { backgroundColor: colors.forest700, borderRadius: radius.lg, paddingHorizontal: 18, paddingVertical: 10, marginBottom: 8 },
  logoText: { color: colors.white, fontWeight: '900', fontSize: 24 },
  tabs: { flexDirection: 'row', backgroundColor: colors.sand100, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.white },
  tabText: { color: colors.forest500, fontWeight: '700' },
  tabTextActive: { color: colors.forest800 },
  label: { fontSize: font.tiny, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, color: colors.forest600, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.white },
  forgot: { textAlign: 'center', color: colors.forest500, fontWeight: '600', fontSize: font.small },
});

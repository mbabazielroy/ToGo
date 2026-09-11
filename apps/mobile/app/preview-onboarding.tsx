import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../src/components/Screen';
import { Card, Muted, PrimaryButton } from '../src/components/ui';
import { colors, radius, space, font } from '../src/theme';

type Tab = 'signin' | 'signup' | 'reset';

/**
 * Preview onboarding — a faithful but INERT walkthrough of the connected sign-in /
 * create-account flow, so the founder can inspect onboarding in local preview. It
 * authenticates nothing, creates no account, and never collects or persists a real
 * password: the field's value lives only in local state and is cleared on submit.
 */
export default function PreviewOnboarding() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [outcome, setOutcome] = useState<string | null>(null);

  function simulate() {
    setPassword(''); // never keep the password
    if (tab === 'signin') {
      setOutcome('In the connected app this would sign you in and load only the workspaces your account is assigned to.');
    } else if (tab === 'signup') {
      setOutcome('In the connected app this would create a PASSENGER account (no staff or admin role) and email a confirmation link. Staff access is granted separately by an administrator.');
    } else {
      setOutcome('In the connected app this would email a password-reset link, if the address has an account.');
    }
  }

  return (
    <Screen showHeader={false}>
      <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" style={styles.back}>
        <Ionicons name="chevron-back" size={22} color={colors.forest700} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>

      <View style={styles.banner}>
        <Ionicons name="eye-outline" size={16} color={colors.forest700} />
        <Text style={styles.bannerText}>
          Preview onboarding — a walkthrough of the real sign-up experience. Not real registration: no account
          is created, and nothing you type (including the password) is saved or sent.
        </Text>
      </View>

      <View style={{ alignItems: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        <View style={styles.logo}><Text style={styles.logoText}>ToGo</Text></View>
        <Muted>Your bus. Your stop. — Connected pilot sign in (preview).</Muted>
      </View>

      <Card style={{ gap: 12 }}>
        <View style={styles.tabs}>
          {(['signin', 'signup'] as const).map((k) => (
            <Pressable key={k} onPress={() => { setTab(k); setOutcome(null); }} style={[styles.tab, tab === k && styles.tabActive]}>
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
          <View><Text style={styles.label}>Password (not saved in preview)</Text>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="••••••••" secureTextEntry placeholderTextColor={colors.muted} /></View>
        )}

        {outcome && (
          <View style={styles.outcome}>
            <Ionicons name="checkmark-circle-outline" size={16} color={colors.forest700} />
            <Text style={styles.outcomeText}>{outcome}</Text>
          </View>
        )}

        <PrimaryButton
          title={tab === 'signin' ? 'Preview sign in' : tab === 'signup' ? 'Preview create passenger account' : 'Preview reset link'}
          onPress={simulate}
        />
        {tab === 'signin' && <Pressable onPress={() => { setTab('reset'); setOutcome(null); }}><Text style={styles.forgot}>Forgot your password?</Text></Pressable>}
        <View style={styles.roleNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color={colors.forest700} />
          <Text style={styles.roleNoteText}>
            Public sign-up creates a passenger account only — never a staff or platform-admin role. Staff
            workspaces are granted separately by an administrator and resolved on the server.
          </Text>
        </View>
      </Card>

      <Muted style={{ textAlign: 'center', fontSize: font.tiny, marginTop: space.md }}>
        Local preview · Illustrates the connected onboarding. No real accounts, passwords, or data.
      </Muted>
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.forest700, fontWeight: '600', fontSize: font.body },
  banner: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.md, marginTop: space.xs },
  bannerText: { flex: 1, color: colors.forest800, fontSize: font.small, lineHeight: 19 },
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
  outcome: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.sm },
  outcomeText: { flex: 1, color: colors.forest800, fontSize: font.small, lineHeight: 19 },
  roleNote: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: colors.forest50, borderRadius: radius.md, padding: space.sm },
  roleNoteText: { flex: 1, color: colors.forest700, fontSize: font.tiny, lineHeight: 17 },
});

import { useEffect, useState } from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import * as Linking from 'expo-linking';
import { useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { Card, Muted, PrimaryButton, ErrorRow } from '@/components/ui';
import { PasswordField } from '@/components/PasswordField';
import { useAuth } from '@/auth/AuthProvider';
import { useToast } from '@/components/ToastProvider';
import { radius, space, font, useColors, makeStyles } from '@/theme';
import { APP_VARIANT, SUPPORT_EMAIL } from '@/env';
import { BrandMark } from '@/components/BrandMark';
import {
  authErrorMessage, cleanCode, codeLooksValid, emailLooksValid, needsEmailConfirmation, newPasswordProblem,
  EMAIL_CODE_LENGTH, EMAIL_CODE_MINUTES, RESEND_SECONDS,
} from '@shared/lib/authRules';

// Sign in, create an account, confirm it, and recover a forgotten password.
//
// Confirmation and reset use an 8-digit code from the email, typed here, so they
// work even when the email is read on another device. The email also carries a
// link, which works only on this phone (PKCE; see src/auth/authLink.ts).
// Nothing on this screen says whether an email has an account.
type Step = 'signin' | 'signup' | 'confirm' | 'forgot' | 'reset';

export default function AuthScreen() {
  const colors = useColors();
  const styles = useStyles();
  const auth = useAuth();
  const { session, recoveryMode } = auth;
  const toast = useToast();
  const router = useRouter();
  const { next, staff } = useLocalSearchParams<{ next?: string; staff?: string }>();
  const returnTo = (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/') as Href;
  const [step, setStep] = useState<Step>('signin');
  // Staff accounts are issued by an operator, never created in the app.
  const staffOnly = !!staff || APP_VARIANT === 'staff';

  // Once signed in, continue to the preserved journey (or Home). This keeps the
  // selected trip through sign-in without ever reserving before authentication.
  useEffect(() => {
    if (session && !recoveryMode) router.replace(returnTo);
  }, [session, recoveryMode, returnTo, router]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  function go(s: Step) { setStep(s); setErr(null); setCode(''); if (s === 'reset' || s === 'signup') setPassword(''); }

  async function run(work: () => Promise<void>) {
    setErr(null); setBusy(true);
    try { await work(); }
    catch (e) {
      if (step === 'signin' && needsEmailConfirmation(e)) { go('confirm'); toast('Confirm your email to finish signing in.', 'ok'); }
      else setErr(authErrorMessage(e));
    }
    finally { setBusy(false); }
  }

  function submit() {
    const mail = email.trim();
    if (!emailLooksValid(mail)) { setErr('Enter a valid email address.'); return; }
    switch (step) {
      case 'signin':
        if (!password) { setErr('Enter your password.'); return; }
        return run(() => auth.signIn(mail, password));
      case 'signup': {
        const problem = newPasswordProblem(password, { email: mail, name: fullName });
        if (problem) { setErr(problem); return; }
        return run(async () => {
          const { needsConfirmation } = await auth.signUp(mail, password, fullName.trim() || 'Traveller', Linking.createURL('/'));
          if (needsConfirmation) { setCooldown(RESEND_SECONDS); go('confirm'); }
        });
      }
      case 'confirm':
        if (!codeLooksValid(code)) { setErr(`Enter the ${EMAIL_CODE_LENGTH}-digit code from the email.`); return; }
        return run(async () => { await auth.verifySignupCode(mail, code); toast('Email confirmed. Welcome to ToGo.', 'ok'); });
      case 'forgot':
        return run(async () => {
          await auth.resetPassword(mail, Linking.createURL('/reset'));
          setCooldown(RESEND_SECONDS);
          go('reset');
        });
      case 'reset': {
        if (!codeLooksValid(code)) { setErr(`Enter the ${EMAIL_CODE_LENGTH}-digit code from the email.`); return; }
        const problem = newPasswordProblem(password, { email: mail });
        if (problem) { setErr(problem); return; }
        return run(async () => {
          await auth.resetWithCode(mail, code, password);
          toast('Password changed. Other devices were signed out.', 'ok');
        });
      }
    }
  }

  function resend() {
    if (cooldown > 0) return;
    const mail = email.trim();
    run(async () => {
      if (step === 'confirm') await auth.resendSignupCode(mail, Linking.createURL('/'));
      else await auth.resetPassword(mail, Linking.createURL('/reset'));
      setCooldown(RESEND_SECONDS);
      toast('If an account needs it, a new email is on its way.', 'ok');
    });
  }

  const codeStep = step === 'confirm' || step === 'reset';
  const title = {
    signin: 'Sign in', signup: 'Create passenger account', confirm: 'Confirm email',
    forgot: 'Email me a reset code', reset: 'Set new password',
  }[step];
  const lead = step === 'confirm'
    ? `If ${email.trim()} is new to ToGo, we've sent it a ${EMAIL_CODE_LENGTH}-digit code. It lasts ${EMAIL_CODE_MINUTES} minutes. Already have an account? Sign in or reset your password instead.`
    : step === 'forgot'
      ? 'Enter your account email. We’ll send a code to set a new password.'
      : step === 'reset'
        ? `If ${email.trim()} has a ToGo account, we've sent it a ${EMAIL_CODE_LENGTH}-digit code. It lasts ${EMAIL_CODE_MINUTES} minutes.`
        : null;

  return (
    <Screen showHeader={false}>
      <Pressable onPress={() => (codeStep || step === 'forgot' ? go('signin') : router.canGoBack() ? router.back() : router.replace('/'))} accessibilityRole="button" accessibilityLabel={codeStep || step === 'forgot' ? 'Back to sign in' : 'Not now'} style={styles.back}>
        <Ionicons name={codeStep || step === 'forgot' ? 'chevron-back' : 'close'} size={24} color={colors.forest700} />
        <Text style={styles.backText}>{codeStep || step === 'forgot' ? 'Back' : 'Not now'}</Text>
      </Pressable>
      <View style={{ alignItems: 'center', marginTop: space.sm, marginBottom: space.lg }}>
        <View style={{ marginBottom: 8 }}><BrandMark size={72} /></View>
        <Muted>{staff ? 'Sign in with your staff account.' : next?.startsWith('/book') ? 'Sign in to reserve your seat.' : 'Your bus. Your stop.'}</Muted>
      </View>
      <Card style={{ gap: 12 }}>
        {(step === 'signin' || step === 'signup') && (
          <View style={styles.tabs} accessibilityRole="tablist">
            {(staffOnly ? ['signin'] as const : ['signin', 'signup'] as const).map((k) => (
              <Pressable key={k} onPress={() => go(k)} accessibilityRole="tab" accessibilityState={{ selected: step === k }} style={[styles.tab, step === k && styles.tabActive]}>
                <Text style={[styles.tabText, step === k && styles.tabTextActive]}>{k === 'signin' ? 'Sign in' : 'Create account'}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {(codeStep || step === 'forgot') && (
          <Text style={styles.heading} accessibilityRole="header">
            {step === 'confirm' ? 'Check your email' : step === 'forgot' ? 'Forgot your password?' : 'Check your email'}
          </Text>
        )}
        {lead && <Text style={styles.lead}>{lead}</Text>}

        {step === 'signup' && (
          <View><Text style={styles.label}>Full name</Text>
            <TextInput style={styles.input} value={fullName} onChangeText={setFullName} placeholder="Amina N." placeholderTextColor={colors.muted} autoComplete="name" textContentType="name" accessibilityLabel="Full name" /></View>
        )}
        {!codeStep && (
          <View><Text style={styles.label}>Email</Text>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType={step === 'signup' ? 'emailAddress' : 'username'} autoComplete={step === 'signup' ? 'email' : 'username'} placeholderTextColor={colors.muted} accessibilityLabel="Email" /></View>
        )}
        {codeStep && (
          <View><Text style={styles.label}>Code from the email</Text>
            <TextInput style={[styles.input, styles.code]} value={code} onChangeText={(v) => setCode(cleanCode(v))} placeholder={'0'.repeat(EMAIL_CODE_LENGTH)} keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={EMAIL_CODE_LENGTH + 4} placeholderTextColor={colors.faint} accessibilityLabel={`${EMAIL_CODE_LENGTH}-digit code from the email`} /></View>
        )}
        {step === 'signin' && <PasswordField label="Password" value={password} onChange={setPassword} onSubmit={submit} />}
        {step === 'signup' && <PasswordField label="Password" value={password} onChange={setPassword} isNew context={{ email, name: fullName }} />}
        {step === 'reset' && <PasswordField label="New password" value={password} onChange={setPassword} isNew context={{ email }} onSubmit={submit} />}

        {err && <ErrorRow message={err} />}
        <PrimaryButton title={title} onPress={submit} loading={busy} />

        {step === 'signin' && <Pressable onPress={() => go('forgot')} accessibilityRole="button" hitSlop={8}><Text style={styles.linkBtn}>Forgot your password?</Text></Pressable>}
        {codeStep && (
          <Pressable onPress={resend} disabled={cooldown > 0 || busy} accessibilityRole="button" accessibilityState={{ disabled: cooldown > 0 }} hitSlop={8}>
            <Text style={[styles.linkBtn, cooldown > 0 && { color: colors.muted }]}>{cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}</Text>
          </Pressable>
        )}
        {codeStep && <Text style={styles.small}>No email? Check your spam folder, and that the address is right.</Text>}
        {step === 'signup' && (
          <Text style={styles.agree}>
            By creating an account you agree to the{' '}
            <Text style={styles.link} onPress={() => router.push('/legal?doc=terms')} accessibilityRole="link">Terms of use</Text> and{' '}
            <Text style={styles.link} onPress={() => router.push('/legal?doc=privacy')} accessibilityRole="link">Privacy policy</Text>.
          </Text>
        )}
      </Card>
      {(step === 'forgot' || step === 'reset') && SUPPORT_EMAIL ? (
        <Text style={styles.foot}>
          Can’t get into your email?{' '}
          <Text style={styles.link} accessibilityRole="link" onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=ToGo%20account%20access`).catch(() => {})}>Contact support</Text>
        </Text>
      ) : (
        <Muted style={{ textAlign: 'center', fontSize: font.tiny, marginTop: space.md }}>
          {staffOnly ? 'Staff accounts are set up by your operator.' : 'Staff accounts are set up by an operator, not here.'}
        </Muted>
      )}
    </Screen>
  );
}

const useStyles = makeStyles((colors) => ({
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.forest700, fontWeight: '600', fontSize: font.body },
  tabs: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 4 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  tabActive: { backgroundColor: colors.thumb },
  tabText: { color: colors.inkSoft, fontWeight: '600' },
  tabTextActive: { color: colors.ink },
  heading: { fontSize: font.h2, fontWeight: '700', color: colors.ink },
  lead: { fontSize: font.small, color: colors.inkSoft, lineHeight: 20 },
  label: { fontSize: font.tiny, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.surface },
  code: { fontSize: 24, letterSpacing: 6, fontWeight: '700', textAlign: 'center' },
  agree: { textAlign: 'center', fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
  small: { textAlign: 'center', fontSize: font.tiny, color: colors.muted, lineHeight: 17 },
  link: { color: colors.forest700, fontWeight: '600' },
  linkBtn: { textAlign: 'center', color: colors.forest700, fontWeight: '600', fontSize: font.small },
  foot: { textAlign: 'center', fontSize: font.tiny, color: colors.muted, marginTop: space.md },
}));

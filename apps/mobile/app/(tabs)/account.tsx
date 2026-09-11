import { useEffect, useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H1, H2, Muted, Label, PrimaryButton, GhostButton, EmptyState } from '../../src/components/ui';
import { useAppMode, useResetDemo } from '../../src/data/AdapterProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useToast } from '../../src/components/ToastProvider';
import { humanError } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';

export default function Account() {
  const mode = useAppMode();
  const resetDemo = useResetDemo();
  const toast = useToast();
  const router = useRouter();
  const { session, user, profile, signOut, updatePassword, updateProfile } = useAuth();
  const [pw, setPw] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState<null | 'pw' | 'profile'>(null);

  useEffect(() => {
    setName(profile?.full_name ?? '');
    setPhone(profile?.phone ?? '');
  }, [profile?.full_name, profile?.phone]);

  const dirty = (name.trim() !== (profile?.full_name ?? '')) || (phone.trim() !== (profile?.phone ?? ''));

  function confirmReset() {
    Alert.alert('Reset demo', 'This clears all demo bookings and activity on this device.', [
      { text: 'Keep data', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetDemo(); toast('Demo reset to seed data.', 'ok'); } },
    ]);
  }
  async function saveProfile() {
    setBusy('profile');
    try { await updateProfile({ full_name: name.trim() || 'Traveller', phone: phone.trim() || null }); toast('Profile updated.', 'ok'); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(null); }
  }
  async function changePassword() {
    if (pw.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    setBusy('pw');
    try { await updatePassword(pw); toast('Password updated.', 'ok'); setPw(''); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(null); }
  }

  const connectedSignedOut = mode === 'connected' && !session;

  return (
    <Screen>
      <H1>Account</H1>

      {mode === 'connected' && connectedSignedOut && (
        <View style={{ gap: space.md, marginTop: space.sm }}>
          <EmptyState title="Not signed in">Sign in to manage your profile, see your trips, and reserve seats.</EmptyState>
          <PrimaryButton title="Sign in or create account" onPress={() => router.push('/auth?next=/account')} />
        </View>
      )}

      {mode === 'connected' && !connectedSignedOut && (
        <>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.avatar}><Ionicons name="person-circle" size={30} color={colors.forest700} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{profile?.full_name ?? 'Traveller'}</Text>
                <Muted style={{ fontSize: font.small }}>{user?.email}</Muted>
              </View>
            </View>
          </Card>

          <Card style={{ gap: 10 }}>
            <H2>Profile</H2>
            <View><Label>Full name</Label>
              <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Amina N." placeholderTextColor={colors.muted} accessibilityLabel="Full name" /></View>
            <View><Label>Phone (optional)</Label>
              <TextInput style={styles.input} value={phone} onChangeText={setPhone} placeholder="+256 7xx" keyboardType="phone-pad" placeholderTextColor={colors.muted} accessibilityLabel="Phone" /></View>
            <PrimaryButton title="Save profile" onPress={saveProfile} loading={busy === 'profile'} disabled={!dirty} />
          </Card>

          <Card style={{ gap: 10 }}>
            <H2>Change password</H2>
            <TextInput style={styles.input} secureTextEntry value={pw} onChangeText={setPw} placeholder="New password (min 6)" placeholderTextColor={colors.muted} accessibilityLabel="New password" />
            <PrimaryButton title="Update password" onPress={changePassword} loading={busy === 'pw'} />
          </Card>
          <GhostButton title="Sign out" onPress={signOut} danger />
        </>
      )}

      {mode === 'demo' && (
        <>
          <Card style={{ gap: 6 }}>
            <H2>Demo profile</H2>
            <Muted>You are in local demo mode — no account needed. Bookings persist on this device only and are not shared.</Muted>
          </Card>
          <Card style={{ gap: 10 }}>
            <Label>Reset demo</Label>
            <Muted>Restore fresh seed data and clear demo bookings on this device.</Muted>
            <GhostButton title="Reset demo data" onPress={confirmReset} danger />
          </Card>
        </>
      )}

      <Card style={{ gap: 6 }}>
        <H2>About</H2>
        <Muted>
          ToGo is a virtual bus terminal pilot for the Kampala ⇄ Mbarara corridor, founded by Elroy and Millie.
          Fares are settled directly with the operator — you pay at boarding, and no payment is collected in the app.
        </Muted>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatar: { width: 48, height: 48, borderRadius: radius.lg, backgroundColor: colors.forest100, alignItems: 'center', justifyContent: 'center' },
  name: { fontWeight: '600', color: colors.ink, fontSize: font.title },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: font.body, color: colors.ink, minHeight: 48, backgroundColor: colors.white },
});

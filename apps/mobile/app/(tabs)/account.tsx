import { useState } from 'react';
import { View, Text, TextInput, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '../../src/components/Screen';
import { Card, H1, H2, Muted, Label, PrimaryButton, GhostButton } from '../../src/components/ui';
import { useAppMode, useResetDemo } from '../../src/data/AdapterProvider';
import { useAuth } from '../../src/auth/AuthProvider';
import { useToast } from '../../src/components/ToastProvider';
import { humanError } from '../../src/hooks/useAsync';
import { colors, radius, space, font } from '../../src/theme';

export default function Account() {
  const mode = useAppMode();
  const resetDemo = useResetDemo();
  const toast = useToast();
  const { user, profile, signOut, updatePassword } = useAuth();
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);

  function confirmReset() {
    Alert.alert('Reset demo', 'This clears all demo bookings and activity on this device.', [
      { text: 'Keep data', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: async () => { await resetDemo(); toast('Demo reset to seed data.', 'ok'); } },
    ]);
  }

  async function changePassword() {
    if (pw.length < 6) { toast('Password must be at least 6 characters.', 'error'); return; }
    setBusy(true);
    try { await updatePassword(pw); toast('Password updated.', 'ok'); setPw(''); }
    catch (e) { toast(humanError(e), 'error'); }
    finally { setBusy(false); }
  }

  return (
    <Screen>
      <H1>Account</H1>

      {mode === 'connected' ? (
        <>
          <Card style={{ gap: 6 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={styles.avatar}><Ionicons name="person-circle" size={30} color={colors.forest700} /></View>
              <View>
                <Text style={styles.name}>{profile?.full_name ?? 'Traveller'}</Text>
                <Muted style={{ fontSize: font.small }}>{user?.email}</Muted>
              </View>
            </View>
          </Card>
          <Card style={{ gap: 10 }}>
            <H2>Change password</H2>
            <TextInput style={styles.input} secureTextEntry value={pw} onChangeText={setPw} placeholder="New password (min 6)" placeholderTextColor={colors.muted} accessibilityLabel="New password" />
            <PrimaryButton title="Update password" onPress={changePassword} loading={busy} />
          </Card>
          <GhostButton title="Sign out" onPress={signOut} />
        </>
      ) : (
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
          All operators, hubs, fares, schedules and tracking are illustrative — not a real transport service,
          and no payment is collected.
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

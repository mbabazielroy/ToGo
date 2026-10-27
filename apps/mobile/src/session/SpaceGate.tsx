import type { ReactNode } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { useSession, spaceOf, homeFor, spaceAllowed, type Space } from './SessionProvider';
import { colors } from '../theme';

export function Splash() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.forest700} />
    </View>
  );
}

/** Renders a space only for identities that belong to it, and only in builds that
 *  contain it; everyone else is sent to their own home (or to the app's entry
 *  screen). This is what keeps the passenger, crew and admin spaces separate. */
export function SpaceGate({ space, children }: { space: Space; children: ReactNode }) {
  const { ready, identity } = useSession();
  if (!ready) return <Splash />;
  if (!identity || !spaceAllowed(space)) return <Redirect href={homeFor(null)} />;
  if (spaceOf(identity.role) !== space) return <Redirect href={homeFor(identity)} />;
  return <>{children}</>;
}

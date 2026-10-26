import { Redirect } from 'expo-router';
import { useSession, homeFor } from '@/session/SessionProvider';
import { Splash } from '@/session/SpaceGate';

/** Entry point: send each identity to its own space; first launch → welcome. */
export default function Index() {
  const { ready, identity } = useSession();
  if (!ready) return <Splash />;
  return <Redirect href={homeFor(identity)} />;
}

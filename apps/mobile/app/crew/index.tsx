import { useLocalSearchParams } from 'expo-router';
import { useSession } from '@/session/SessionProvider';
import { DriverToday } from '@/crew/DriverToday';
import { ConductorToday } from '@/crew/ConductorToday';
import { AttendantToday } from '@/crew/AttendantToday';

/** Today's work for the signed-in crew member, by role. */
export default function CrewToday() {
  const { identity } = useSession();
  const { trip } = useLocalSearchParams<{ trip?: string }>();
  if (!identity?.staffId) return null;
  if (identity.role === 'driver') return <DriverToday key={trip ?? 'd'} staffId={identity.staffId} tripParam={trip} />;
  if (identity.role === 'conductor') return <ConductorToday key={trip ?? 'c'} staffId={identity.staffId} tripParam={trip} />;
  return <AttendantToday staffId={identity.staffId} />;
}

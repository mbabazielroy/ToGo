import type { NotificationView } from '@shared/data/adapter';
import type { PassengerProfile } from '../session/SessionProvider';

// Alert preferences decide which in-app alerts a passenger sees. Reservation,
// cancellation and trip-cancelled alerts always show — they change what the
// passenger has to do. Delays/schedule changes and boarding progress are optional.
const DELAY_KINDS = new Set(['delay', 'schedule_edit']);
const BOARDING_KINDS = new Set(['trip_start', 'reach_hub', 'check_in', 'boarding']);

export function visibleAlerts(items: NotificationView[], prefs: Pick<PassengerProfile, 'notifyDelays' | 'notifyBoarding'>): NotificationView[] {
  return items.filter((n) => {
    if (!prefs.notifyDelays && DELAY_KINDS.has(n.kind)) return false;
    if (!prefs.notifyBoarding && BOARDING_KINDS.has(n.kind)) return false;
    return true;
  });
}

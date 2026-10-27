import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { useAdapter, useAppMode, useDataEpoch } from '../data/AdapterProvider';
import { useAuth } from '../auth/AuthProvider';
import { APP_VARIANT } from '../env';

// Who is using the app, and therefore which space they get:
//   passenger            → the passenger app (Home / Trips / Hubs / Account)
//   driver / conductor / attendant → the crew workspace
//   admin                → the operations console
// Spaces are separate route groups, each guarded by `useSpaceGuard`, so a passenger
// can never navigate into crew or admin screens and vice versa.
//
// Preview mode: identities are fictional personas chosen on the staff sign-in
// screen; choosing one grants nothing beyond filtering on-device simulated data.
// Connected mode: crew/admin identities are only offered when the signed-in
// account is verified for them server-side (my_staff_workspaces / is_platform_admin),
// and every action is re-authorised by the database anyway.

export type Role = 'passenger' | 'driver' | 'conductor' | 'attendant' | 'admin';
export type Space = 'passenger' | 'crew' | 'admin';

export interface Identity {
  role: Role;
  /** Crew: the staff/workspace id the adapter understands. Admin/passenger: unset. */
  staffId?: string;
  name: string;
  /** Short context line, e.g. "Savannah Coaches" or "Nakawa Green Hub". */
  detail?: string;
}

export interface PassengerProfile {
  name: string;
  phone: string;
  homeCity: 'Kampala' | 'Mbarara';
  notifyDelays: boolean;
  notifyBoarding: boolean;
}

interface Stored {
  onboarded: boolean;
  identity: Identity | null;
  profile: PassengerProfile;
}

const KEY = 'togo.mobile.session.v1';
const DEFAULT_PROFILE: PassengerProfile = { name: '', phone: '', homeCity: 'Kampala', notifyDelays: true, notifyBoarding: true };
const DEFAULT: Stored = { onboarded: false, identity: null, profile: DEFAULT_PROFILE };

export const ADMIN_PREVIEW: Identity = { role: 'admin', name: 'Operations team', detail: 'All operators' };

export function spaceOf(role: Role): Space {
  if (role === 'admin') return 'admin';
  if (role === 'passenger') return 'passenger';
  return 'crew';
}

/** Which spaces this build contains: the passenger app has only the passenger
 *  space; ToGo Staff has only crew + operations; the dev build has all three. */
export function spaceAllowed(space: Space): boolean {
  if (APP_VARIANT === 'passenger') return space === 'passenger';
  if (APP_VARIANT === 'staff') return space !== 'passenger';
  return true;
}

export function homeFor(identity: Identity | null): Href {
  const entry: Href = APP_VARIANT === 'staff' ? '/staff-signin' : '/welcome';
  if (!identity) return entry;
  const space = spaceOf(identity.role);
  if (!spaceAllowed(space)) return entry;
  return space === 'admin' ? '/admin' : space === 'crew' ? '/crew' : '/home';
}

export const ROLE_LABEL: Record<Role, string> = {
  passenger: 'Passenger',
  driver: 'Driver',
  conductor: 'Conductor',
  attendant: 'Hub attendant',
  admin: 'Operations admin',
};

interface SessionCtx {
  ready: boolean;
  onboarded: boolean;
  identity: Identity | null;
  profile: PassengerProfile;
  /** Identities this user may switch to (preview: every persona; connected: verified only). */
  available: Identity[];
  availableLoading: boolean;
  refreshAvailable: () => void;
  /** Finish passenger onboarding and enter the passenger app. */
  startPassenger: (profile?: Partial<PassengerProfile>) => Promise<void>;
  /** Enter a crew/admin (or passenger) space as the given identity. */
  signInAs: (identity: Identity) => Promise<void>;
  updateProfile: (patch: Partial<PassengerProfile>) => Promise<void>;
  /** Leave the current space (and, in connected mode, the account) → welcome. */
  signOut: () => Promise<void>;
}

const Ctx = createContext<SessionCtx | null>(null);

function sameIdentity(a: Identity, b: Identity) {
  return a.role === b.role && (a.staffId ?? '') === (b.staffId ?? '');
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const adapter = useAdapter();
  const mode = useAppMode();
  const epoch = useDataEpoch();
  const auth = useAuth();
  const [stored, setStored] = useState<Stored>(DEFAULT);
  const [ready, setReady] = useState(false);
  const [available, setAvailable] = useState<Identity[]>([]);
  const [availableLoading, setAvailableLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (!raw) return;
        const parsed = JSON.parse(raw) as Partial<Stored>;
        setStored({ ...DEFAULT, ...parsed, profile: { ...DEFAULT_PROFILE, ...(parsed.profile ?? {}) } });
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const persist = useCallback((next: Stored) => {
    setStored(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, []);

  // Resolve which crew/admin identities this user may use.
  const signedIn = !!auth.session;
  const isAdmin = !!auth.profile?.is_platform_admin;
  useEffect(() => {
    let active = true;
    setAvailableLoading(true);
    (async () => {
      if (mode === 'connected' && !signedIn) return [] as Identity[];
      const staff = await adapter.listStaff().catch(() => []);
      const crew: Identity[] = staff.map((s) => ({
        role: s.role,
        staffId: s.id,
        name: s.name,
        detail: s.role === 'attendant' ? s.assignedHubName : s.operatorName,
      }));
      const admin = mode === 'demo' ? [ADMIN_PREVIEW] : isAdmin ? [{ role: 'admin' as const, name: auth.profile?.full_name || 'Admin', detail: 'Platform admin' }] : [];
      return [...crew, ...admin];
    })()
      .then((list) => { if (active) setAvailable(list); })
      .finally(() => { if (active) setAvailableLoading(false); });
    return () => { active = false; };
  }, [adapter, mode, signedIn, isAdmin, auth.profile?.full_name, epoch, tick]);

  // Connected: if a crew/admin identity is no longer verified (assignment removed,
  // signed out), fall back to the passenger space rather than show stale access.
  useEffect(() => {
    if (!ready || availableLoading || mode !== 'connected') return;
    const id = stored.identity;
    if (!id || id.role === 'passenger') return;
    if (!available.some((a) => sameIdentity(a, id))) {
      persist({ ...stored, identity: { role: 'passenger', name: stored.profile.name || 'Traveller' } });
    }
  }, [ready, availableLoading, available, mode, stored, persist]);

  const startPassenger = useCallback(async (patch?: Partial<PassengerProfile>) => {
    const profile = { ...stored.profile, ...(patch ?? {}) };
    persist({ onboarded: true, profile, identity: { role: 'passenger', name: profile.name || 'Traveller' } });
    if (mode === 'connected' && auth.session && patch?.name) {
      await auth.updateProfile({ full_name: patch.name, phone: patch.phone || null }).catch(() => {});
    }
  }, [stored, persist, mode, auth]);

  const signInAs = useCallback(async (identity: Identity) => {
    persist({ ...stored, onboarded: true, identity });
  }, [stored, persist]);

  const updateProfile = useCallback(async (patch: Partial<PassengerProfile>) => {
    const profile = { ...stored.profile, ...patch };
    const identity = stored.identity?.role === 'passenger' ? { ...stored.identity, name: profile.name || 'Traveller' } : stored.identity;
    persist({ ...stored, profile, identity });
    if (mode === 'connected' && auth.session && (patch.name !== undefined || patch.phone !== undefined)) {
      await auth.updateProfile({ full_name: profile.name || 'Traveller', phone: profile.phone || null });
    }
  }, [stored, persist, mode, auth]);

  const signOut = useCallback(async () => {
    if (mode === 'connected' && auth.session) await auth.signOut();
    persist({ ...stored, identity: null });
  }, [mode, auth, stored, persist]);

  const value = useMemo<SessionCtx>(() => ({
    ready,
    onboarded: stored.onboarded,
    identity: stored.identity,
    profile: stored.profile,
    available,
    availableLoading,
    refreshAvailable: () => setTick((t) => t + 1),
    startPassenger,
    signInAs,
    updateProfile,
    signOut,
  }), [ready, stored, available, availableLoading, startPassenger, signInAs, updateProfile, signOut]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useSession must be used within SessionProvider');
  return c;
}

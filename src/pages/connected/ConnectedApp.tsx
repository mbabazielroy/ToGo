import { Loader2 } from 'lucide-react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from '../../auth/AuthProvider';
import { AuthScreen } from './AuthScreen';
import { ConnectedShell } from './ConnectedShell';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { PassengerHome } from './pages/PassengerHome';
import { BookPage } from './pages/BookPage';
import { TripDetailPage } from './pages/TripDetailPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { AccountPage } from './pages/AccountPage';
import { AttendantWorkspace } from './workspaces/AttendantWorkspace';
import { ConductorWorkspace } from './workspaces/ConductorWorkspace';
import { OperatorWorkspace } from './workspaces/OperatorWorkspace';
import { AdminWorkspace } from './workspaces/AdminWorkspace';

export function ConnectedApp() {
  const { loading, session, recoveryMode, assignments } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-forest-500">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  // A password-recovery link takes precedence over everything else.
  if (recoveryMode) return <ResetPasswordPage />;

  if (!session) {
    // Unauthenticated: only the auth screen and the recovery form are reachable.
    return (
      <Routes>
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="*" element={<AuthScreen />} />
      </Routes>
    );
  }

  const guard = (allowed: boolean, el: React.ReactNode) =>
    allowed ? el : <Navigate to="/" replace />;

  return (
    <ConnectedShell>
      <Routes>
        <Route path="/" element={<PassengerHome />} />
        <Route path="/book/:tripId" element={<BookPage />} />
        <Route path="/trips/:bookingId" element={<TripDetailPage />} />
        <Route path="/notifications" element={<NotificationsPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/auth/reset" element={<ResetPasswordPage />} />
        <Route path="/staff/attendant"
          element={guard(assignments.hubIds.length > 0, <AttendantWorkspace hubIds={assignments.hubIds} />)} />
        <Route path="/staff/conductor"
          element={guard(assignments.conductorTripIds.length > 0, <ConductorWorkspace tripIds={assignments.conductorTripIds} />)} />
        <Route path="/staff/operator"
          element={guard(assignments.operatorIds.length > 0, <OperatorWorkspace operatorIds={assignments.operatorIds} />)} />
        <Route path="/staff/admin"
          element={guard(assignments.isAdmin, <AdminWorkspace />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ConnectedShell>
  );
}

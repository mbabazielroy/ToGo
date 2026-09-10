import { Routes, Route, Navigate } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Home } from './pages/passenger/Home';
import { Hubs } from './pages/passenger/Hubs';
import { HubDetail } from './pages/passenger/HubDetail';
import { SearchResults } from './pages/passenger/SearchResults';
import { Booking } from './pages/passenger/Booking';
import { MyTrips } from './pages/passenger/MyTrips';
import { TripDetail } from './pages/passenger/TripDetail';
import { Account } from './pages/passenger/Account';
import { Attendant } from './pages/staff/Attendant';
import { Conductor } from './pages/staff/Conductor';
import { Operator } from './pages/staff/Operator';

export default function App() {
  return (
    <AppShell>
      <Routes>
        {/* Passenger */}
        <Route path="/" element={<Home />} />
        <Route path="/hubs" element={<Hubs />} />
        <Route path="/hubs/:hubId" element={<HubDetail />} />
        <Route path="/search" element={<SearchResults />} />
        <Route path="/book/:tripId" element={<Booking />} />
        <Route path="/trips" element={<MyTrips />} />
        <Route path="/trips/:bookingId" element={<TripDetail />} />
        <Route path="/account" element={<Account />} />
        {/* Staff */}
        <Route path="/staff/attendant" element={<Attendant />} />
        <Route path="/staff/conductor" element={<Conductor />} />
        <Route path="/staff/operator" element={<Operator />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

import type { AppState, Hub, Operator, Route, Trip, Vehicle } from '../types';

export function hubById(state: AppState, id: string): Hub | undefined {
  return state.hubs.find((h) => h.id === id);
}
export function operatorById(state: AppState, id: string): Operator | undefined {
  return state.operators.find((o) => o.id === id);
}
export function vehicleById(state: AppState, id: string): Vehicle | undefined {
  return state.vehicles.find((v) => v.id === id);
}
export function routeById(state: AppState, id: string): Route | undefined {
  return state.routes.find((r) => r.id === id);
}
export function tripById(state: AppState, id: string): Trip | undefined {
  return state.trips.find((t) => t.id === id);
}
export function routeForTrip(state: AppState, trip: Trip): Route | undefined {
  return routeById(state, trip.routeId);
}

export const DIRECTION_LABEL: Record<Trip['direction'], string> = {
  KLA_MBR: 'Kampala → Mbarara',
  MBR_KLA: 'Mbarara → Kampala',
};

/** Origin and destination CITIES for a corridor direction. The destination is the
 *  end of the corridor — never a pickup hub in the origin city. */
export const DIRECTION_CITIES: Record<Trip['direction'], { origin: string; destination: string }> = {
  KLA_MBR: { origin: 'Kampala', destination: 'Mbarara' },
  MBR_KLA: { origin: 'Mbarara', destination: 'Kampala' },
};

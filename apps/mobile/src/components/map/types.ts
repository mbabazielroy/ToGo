import type { LatLng } from '@shared/data/geo';

export interface MapRoute { id: string; path: LatLng[]; color: string; dimmed?: boolean }
export interface MapStop {
  id: string;
  coord: LatLng;
  label: string;
  color?: string;
  /** Small count shown on the stop (e.g. passengers to pick up). */
  badge?: number;
  /** Already passed: drawn hollow/grey. */
  passed?: boolean;
  /** The passenger's own stop, or the driver's next stop. */
  highlight?: boolean;
}
export interface MapBus { id: string; coord: LatLng; color: string; label?: string; estimate?: boolean }

export interface TransitMapProps {
  height: number;
  routes?: MapRoute[];
  stops?: MapStop[];
  buses?: MapBus[];
  /** Points the camera should fit; defaults to everything drawn. */
  focus?: LatLng[];
  /** Caption shown over the map (e.g. "Estimated position"). */
  caption?: string;
  onStopPress?: (id: string) => void;
}

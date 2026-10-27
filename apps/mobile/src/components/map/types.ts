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
  height?: number;
  /** Fill the parent instead of a fixed height (full-screen map). */
  fill?: boolean;
  routes?: MapRoute[];
  stops?: MapStop[];
  buses?: MapBus[];
  /** Points the camera should fit; defaults to everything drawn. */
  focus?: LatLng[];
  /** Caption shown over the map (e.g. "Estimated position"). */
  caption?: string;
  /** Stop or bus id to draw as selected. */
  selectedId?: string | null;
  onStopPress?: (id: string) => void;
  onBusPress?: (id: string) => void;
  /** Tap on empty map (used to clear a selection). */
  onMapPress?: () => void;
  /** Embedded preview: the whole map is one button (e.g. "open full map"). */
  onPress?: () => void;
  /** Keep the camera centred on this point (follow-the-bus). */
  follow?: { latitude: number; longitude: number } | null;
  /** Change to re-fit the camera to `focus`. */
  refitToken?: number;
  /** Draw the user's position. */
  userLocation?: LatLng | null;
  /** Space covered by overlays at the bottom (a sheet), so fitting avoids it. */
  bottomInset?: number;
  topInset?: number;
}

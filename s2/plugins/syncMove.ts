import type { S2Map, View, ViewMessage } from 's2/index.js';

/** Handle the sync move event */
export type SyncMoveListener = (event: CustomEvent<ViewMessage>) => void;

/** Containers for the maps and their listeners */
export interface MapContainer {
  id: string;
  map: S2Map;
  onMove: SyncMoveListener;
}

/**
 * Sync the camera between multiple maps
 * @param maps - The maps to sync with eachother
 */
export async function syncMove(...maps: S2Map[]): Promise<void> {
  if (maps.length < 2) return;
  // Grab the first view
  let currentView: Required<View> = await maps[0].getView();
  // Update all the other maps to the same view
  for (let i = 0; i < maps.length; i++) maps[i].jumpTo(currentView);
  // Now listen for changes
  for (const map of maps) {
    /**
     * Sync the cameras and update the view if their views don't match
     * @param event - The move handler to update all the other maps.
     */
    const listener: SyncMoveListener = (event: CustomEvent<ViewMessage>): void => {
      const { view } = event.detail;
      if (!viewAreTheSame(currentView, view)) {
        for (const otherMap of maps) {
          if (otherMap.id !== map.id) otherMap.jumpTo(view);
        }
        currentView = view;
      }
    };
    map.addEventListener('view', listener as EventListener);
    map.addEventListener(
      'delete',
      (): void => {
        map.removeEventListener('view', listener as EventListener);
      },
      { once: true },
    );
  }
}

/**
 * Compare two views allowing from some tolerance
 * @param a - the first view
 * @param b - the second view
 * @returns - true if the views are different
 */
function viewAreTheSame(a: Required<View>, b: Required<View>): boolean {
  const { abs } = Math;
  const eps = 1e-9;
  return (
    abs(a.zoom - b.zoom) > eps ||
    abs(a.lon - b.lon) > eps ||
    abs(a.lat - b.lat) > eps ||
    abs(a.bearing - b.bearing) > eps ||
    abs(a.pitch - b.pitch) > eps
  );
}

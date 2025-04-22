import { preloadMap } from '../preload';
import React, { useEffect, useRef, useState } from 'react';

import type { BuildType } from '../preload';
import type { MapOptions, S2Map } from 's2/index';

/**
 * Props for the S2Map React Component.
 * Props are:
 * - `build`: The build type for the S2Map instance. See {@link BuildType}.
 * - `mapOptions`: The options for the S2Map instance.
 * - `mapReady?`: A function to be called when the S2Map instance is ready. Optional
 * - `version?`: The version of the S2Map instance. Optional
 * - `children?`: Child elements to be rendered inside the S2Map instance. Optional
 */
export interface S2MapReactComponentProps {
  build: BuildType;
  mapOptions: MapOptions;
  mapReady?: (s2map: S2Map) => void;
  version?: string;
  children?: React.ReactNode;
  testing?: boolean;
}

/**
 * S2Map React Component
 * @param props - Props passed to the component
 * @returns - The S2Map React Component
 */
export const ReactS2MapGPU: React.FC<S2MapReactComponentProps> = (
  props: S2MapReactComponentProps,
) => {
  const { mapOptions, mapReady, build, version, children, testing } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<S2Map | null>(null);

  useEffect(() => {
    let map: S2Map | null = null;

    /** Initialize the map */
    const initializeMap = async () => {
      await preloadMap(build, version);
      const S2Map = window.S2Map; // Assuming S2Map is available globally after preload

      if (containerRef.current !== null) {
        const options: MapOptions = {
          ...mapOptions,
          container: containerRef.current,
        };
        map = new S2Map(options);
        if (testing === true) window.testMap = map;
        setMapInstance(map);

        if (typeof mapReady === 'function') {
          map.addEventListener(
            'ready',
            () => {
              mapReady(map!); // Assert map is not null here as it's just been created
            },
            { once: true },
          );
        }
      }
    };

    void initializeMap();

    return () => {
      if (mapInstance !== null) mapInstance.delete();
    };
  }, [mapOptions, mapReady, build, version]);

  return (
    <div
      id="map"
      ref={containerRef}
      style={{ position: 'absolute', top: 0, bottom: 0, width: '100%', height: '100%' }}
    >
      {children}
    </div>
  );
};

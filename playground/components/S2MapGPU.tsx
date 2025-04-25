import React, { useEffect, useRef, useState } from 'react';

import type { MapOptions, S2Map } from 's2/index';

/**
 * Props for the S2Map React Component.
 * Props are:
 * - `mapOptions`: The options for the S2Map instance.
 * - `mapReady?`: A function to be called when the S2Map instance is ready. Optional
 * - `children?`: Child elements to be rendered inside the S2Map instance. Optional
 */
export interface S2MapReactComponentProps {
  mapOptions: MapOptions;
  mapReady?: (s2map: S2Map) => void;
  children?: React.ReactNode;
}

/**
 * S2Map React Component
 * @param props - Props passed to the component
 * @returns - The S2Map React Component
 */
export const S2MapGPU: React.FC<S2MapReactComponentProps> = (props: S2MapReactComponentProps) => {
  const { mapOptions, mapReady, children } = props;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [mapInstance, setMapInstance] = useState<S2Map | null>(null);

  useEffect(() => {
    let map: S2Map | null = null;

    /** Initialize the map */
    const initializeMap = async () => {
      const { S2Map } = await import('s2');

      if (containerRef.current !== null) {
        const options: MapOptions = {
          urlMap: {
            baseURL: 'http://localhost:3000',
            dataURL: 'http://localhost:3000',
          },
          attributionOff: true,
          watermarkOff: true,
          controls: false,
          ...mapOptions,
          container: containerRef.current,
        };
        map = new S2Map(options);
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
  }, [mapOptions, mapReady]);

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

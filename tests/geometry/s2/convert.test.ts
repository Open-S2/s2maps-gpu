import { toWM } from 'geometry/s2/convert';
import { describe, expect, it } from 'bun:test';

import type { S2Feature } from 'gis-tools';

describe('toWM', () => {
  it('should convert an S2Feature to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'Point' as const,
        is3D: false,
        coordinates: { x: 0.5, y: 0.5 },
      },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'Feature',
      properties: { name: 'test' },
      geometry: {
        type: 'Point',
        coordinates: [0, 0],
      },
    });
  });

  it('should throw an error if the conversion is not yet supported or Invalid S2Geometry type', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiPoint' as const,
        coordinates: [[0.5, 0.5]],
      },
    };
    expect(() => toWM(s2Feature)).toThrow(
      'Either the conversion is not yet supported or Invalid S2Geometry type.',
    );
  });

  it("should throw an error if it's Invalid S2Geometry type", () => {
    const feature = { type: 'S2Feature', geometry: { type: 'badInput' } };
    expect(() => toWM(feature as never)).toThrow(
      'Either the conversion is not yet supported or Invalid S2Geometry type.',
    );
  });
});

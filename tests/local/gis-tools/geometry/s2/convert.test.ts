import { toWM } from '../../../../../s2/gis-tools/geometry/s2/convert';
import { describe, expect, it } from 'bun:test';

import type { S2Feature } from '../../../../../s2/gis-tools/geometry';

describe('toWM', () => {
  it('should convert an S2Feature Point to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0.5, y: 0.5, m: { a: 0.5 } },
        bbox: [0, 0, 0.5, 1],
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'Point',
        is3D: false,
        coordinates: { x: 0, y: 0, m: { a: 0.5 } },
        bbox: [0, 0, 0.5, 1],
      },
      metadata: { name2: 'test2' },
    });
  });

  it('should throw an error if the conversion is not yet supported or Invalid S2Geometry type', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      face: 0,
      properties: { name: 'test' },
      geometry: {
        // @ts-expect-error - invalid type on purpose
        type: 'MultiPoints',
        coordinates: [{ x: 0.5, y: 0.5 }],
      },
    };
    expect(() => toWM(s2Feature)).toThrow('Invalid S2Geometry type');
  });

  it("should throw an error if it's Invalid S2Geometry type", () => {
    const feature = { type: 'S2Feature', geometry: { type: 'badInput' } };
    expect(() => toWM(feature as never)).toThrow('Invalid S2Geometry type');
  });

  it('should convert an S2Feature MultiPoint to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiPoint',
        is3D: false,
        coordinates: [
          { x: 0.5, y: 0.5, m: { a: 0.5 } },
          { x: 1.0, y: 1.0, m: { a: 2.5 } },
        ],
        bbox: [0, 0, 0.5, 1],
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiPoint',
        is3D: false,
        coordinates: [
          { x: 0, y: 0, m: { a: 0.5 } },
          { x: 45, y: 35.264389682754654, m: { a: 2.5 } },
        ],
        bbox: [0, 0, 0.5, 1],
      },
      metadata: { name2: 'test2' },
    });
  });

  it('should convert an S2Feature LineString to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'LineString',
        is3D: false,
        coordinates: [
          { x: 0.5, y: 0.5, m: { a: 0.5 } },
          { x: 1.0, y: 1.0, m: { a: 2.5 } },
        ],
        bbox: [0, 0, 0.5, 1],
        offset: 1,
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'LineString',
        is3D: false,
        coordinates: [
          { x: 0, y: 0, m: { a: 0.5 } },
          { x: 45, y: 35.264389682754654, m: { a: 2.5 } },
        ],
        bbox: [0, 0, 0.5, 1],
        offset: 1,
      },
      metadata: { name2: 'test2' },
    });
  });

  it('should convert an S2Feature MultiLineString to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiLineString',
        is3D: false,
        coordinates: [
          [
            { x: 0.5, y: 0.5, m: { a: 0.5 } },
            { x: 1.0, y: 1.0, m: { a: 2.5 } },
          ],
          [
            { x: -0.5, y: -0.5, m: { a: -0.5 } },
            { x: 2.0, y: 2.0, m: { a: -2.5 } },
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [0, 1],
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiLineString',
        is3D: false,
        coordinates: [
          [
            { x: 0, y: 0, m: { a: 0.5 } },
            { x: 45, y: 35.264389682754654, m: { a: 2.5 } },
          ],
          [
            { x: -69.44395478041653, y: -43.116665552628184, m: { a: -0.5 } },
            { x: 78.69006752597979, y: 44.43824067114979, m: { a: -2.5 } },
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [0, 1],
      },
      metadata: { name2: 'test2' },
    });
  });

  it('should convert an S2Feature Polygon to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'Polygon',
        is3D: false,
        coordinates: [
          [
            { x: 0.5, y: 0.5, m: { a: 0.5 } },
            { x: 1.0, y: 1.0, m: { a: 2.5 } },
          ],
          [
            { x: -0.5, y: -0.5, m: { a: -0.5 } },
            { x: 2.0, y: 2.0, m: { a: -2.5 } },
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [0.123, 0.456],
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'Polygon',
        is3D: false,
        coordinates: [
          [
            { x: 0, y: 0, m: { a: 0.5 } },
            { x: 45, y: 35.264389682754654, m: { a: 2.5 } },
          ],
          [
            { x: -69.44395478041653, y: -43.116665552628184, m: { a: -0.5 } },
            { x: 78.69006752597979, y: 44.43824067114979, m: { a: -2.5 } },
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [0.123, 0.456],
      },
      metadata: { name2: 'test2' },
    });
  });

  it('should convert an S2Feature MultiPolygon to a GeoJSON Feature', () => {
    const s2Feature: S2Feature = {
      type: 'S2Feature',
      id: 2,
      face: 0,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiPolygon',
        is3D: false,
        coordinates: [
          [
            [
              { x: 0.5, y: 0.5, m: { a: 0.5 } },
              { x: 1.0, y: 1.0, m: { a: 2.5 } },
            ],
            [
              { x: -0.5, y: -0.5, m: { a: -0.5 } },
              { x: 2.0, y: 2.0, m: { a: -2.5 } },
            ],
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [[0.123, 0.456]],
      },
      metadata: { name2: 'test2' },
    };
    expect(toWM(s2Feature)).toEqual({
      type: 'VectorFeature',
      id: 2,
      properties: { name: 'test' },
      geometry: {
        type: 'MultiPolygon',
        is3D: false,
        coordinates: [
          [
            [
              { x: 0, y: 0, m: { a: 0.5 } },
              { x: 45, y: 35.264389682754654, m: { a: 2.5 } },
            ],
            [
              { x: -69.44395478041653, y: -43.116665552628184, m: { a: -0.5 } },
              { x: 78.69006752597979, y: 44.43824067114979, m: { a: -2.5 } },
            ],
          ],
        ],
        bbox: [0, 0, 0.5, 1],
        offset: [[0.123, 0.456]],
      },
      metadata: { name2: 'test2' },
    });
  });
});

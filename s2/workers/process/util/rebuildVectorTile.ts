import { VTTile } from '../process.spec.js';

import type { VectorGeometry } from 'gis-tools/index.js';

/**
 * TODO: Add in offset data as needed
 * Build functions back into the vector tile and its layers & features
 * @param vectorTile - input vector tile
 */
export function rebuildVectorTile(vectorTile: VTTile): void {
  for (const layer of Object.values(vectorTile.layers)) {
    if (layer.features === undefined) continue;
    // re-inject length
    layer.length = layer.features.length;
    /**
     * Get the feature at the given index
     * @param i - the feature index
     * @returns the feature at the given index
     */
    layer.feature = function (i: number) {
      return this.features![i];
    };
    /** loop over features */
    for (const feature of layer.features) {
      /** @returns the feature geometry type */
      feature.geoType = function () {
        return (this.geometry as VectorGeometry).type;
      };
      /** @returns a loader for point geometry */
      feature.loadPoints = function () {
        const { type, coordinates } = this.geometry as VectorGeometry;
        if (type === 'Point') {
          return [coordinates];
        } else if (type === 'MultiPoint') {
          return coordinates;
        } else if (type === 'LineString') {
          return coordinates;
        } else if (type === 'MultiLineString') {
          return coordinates.flat();
        } else if (type === 'Polygon') {
          return coordinates.flat();
        } else if (type === 'MultiPolygon') {
          return coordinates.flat(2);
        }
      };
      /** @returns a loader for line geometry */
      feature.loadLines = function () {
        const { type, coordinates } = this.geometry as VectorGeometry;
        if (type === 'LineString') {
          return [[coordinates], []];
        } else if (type === 'MultiLineString') {
          return [coordinates, []];
        } else if (type === 'Polygon') {
          return [coordinates, []];
        } else if (type === 'MultiPolygon') {
          return [coordinates.flat(), []];
        }
      };
      /** @returns a loader for polygon geometry */
      feature.loadPolys = function () {
        const { type, coordinates, offset } = this.geometry as VectorGeometry;
        if (type === 'Polygon') {
          return [[coordinates], offset !== undefined ? [offset] : []];
        } else if (type === 'MultiPolygon') {
          return [coordinates, offset ?? []];
        }
      };
    }
  }
}

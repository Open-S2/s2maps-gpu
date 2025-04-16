import { EARTH_RADIUS } from '../../../space/planets/index.js';

import type {
  MValue,
  Properties,
  VectorFeature,
  VectorLineString,
  VectorMultiPolygon,
  VectorMultiPolygonGeometry,
  VectorPolygon,
  VectorPolygonGeometry,
} from '../../../index.js';

// TODO: polygon(s)AreaS2(...)

/**
 * Find the area of a collection of polygons. Assumes geometry is in lon-lat space
 * @param polygons - the collection of polygons
 * @param planetRadius - the radius of the planet (Earth by default). Set to 1 if you want the raw area
 * @returns - the total area of the polygon in square meters
 */
export function polygonsArea<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  polygons:
    | VectorMultiPolygon<D>
    | VectorMultiPolygonGeometry<D>
    | VectorFeature<M, D, P, VectorMultiPolygonGeometry<D>>,
  planetRadius = EARTH_RADIUS,
): number {
  const vectorPolygons: VectorMultiPolygon =
    'geometry' in polygons
      ? polygons.geometry.coordinates
      : 'coordinates' in polygons
        ? polygons.coordinates
        : polygons;

  let area = 0;
  for (const polygon of vectorPolygons) area += polygonArea(polygon, planetRadius);

  return area;
}

/**
 * Find the area of a polygon. Assumes geometry is in Lon-Lat space
 * @param polygon - the polygon
 * @param planetRadius - the radius of the planet (Earth by default)
 * @returns - The approximate signed geodesic area of the polygon in square meters.
 */
export function polygonArea<
  M = Record<string, unknown>,
  D extends MValue = Properties,
  P extends Properties = Properties,
>(
  polygon:
    | VectorPolygon<D>
    | VectorPolygonGeometry<D>
    | VectorFeature<M, D, P, VectorPolygonGeometry<D>>,
  planetRadius = EARTH_RADIUS,
): number {
  // check poly against the point
  const vectorPolygon: VectorPolygon =
    'geometry' in polygon
      ? polygon.geometry.coordinates
      : 'coordinates' in polygon
        ? polygon.coordinates
        : polygon;

  // grab the area of the outer ring
  let area = _ringArea(vectorPolygon[0], planetRadius);
  // subtract the area of the inner rings (holes)
  for (let i = 1; i < vectorPolygon.length; i++) {
    area -= _ringArea(vectorPolygon[i], planetRadius);
  }

  return area;
}

/**
 * Calculate the approximate area of the polygon were it projected onto the planet.
 * Note that this area will be positive if ring is oriented counter-clockwise,
 * otherwise it will be negative.
 *
 * Reference:
 * Robert. G. Chamberlain and William H. Duquette, "Some Algorithms for Polygons on a Sphere",
 * JPL Publication 07-03, Jet Propulsion
 * Laboratory, Pasadena, CA, June 2007 https://trs.jpl.nasa.gov/handle/2014/40409
 * @param coords - ring Coordinates in lon-lat space
 * @param planetRadius - the radius of the planet (Earth by default)
 * @returns - The approximate signed geodesic area of the polygon in square meters.
 */
function _ringArea<M extends MValue = Properties>(
  coords: VectorLineString<M>,
  planetRadius: number,
): number {
  const RAD = 0.017453292519943295; // Math.PI / 180;
  const coordsLength = coords.length - 1;
  const factor = (planetRadius * planetRadius) / 2;

  if (coordsLength <= 2) return 0;
  let total = 0;

  let i = 0;
  while (i < coordsLength) {
    const lower = coords[i];
    const middle = coords[i + 1 === coordsLength ? 0 : i + 1];
    const upper = coords[i + 2 >= coordsLength ? (i + 2) % coordsLength : i + 2];

    const lowerX = lower.x * RAD;
    const middleY = middle.y * RAD;
    const upperX = upper.x * RAD;

    total += (upperX - lowerX) * Math.sin(middleY);

    i++;
  }

  return -(total * factor);
}

import { degToRad, radToDeg } from '../geometry/index.js';

import type { LonLat } from '../geometry/index.js';

/**
 * # Orthodrome
 *
 * ## Description
 * Represents an orthodrome, which is the shortest path between two points on a sphere.
 * [Learn more here](http://www.movable-type.co.uk/scripts/latlong.html)
 *
 * ## Usage
 * ```ts
 * import { Orthodrome } from 'gis-tools-ts'
 *
 * // starting at lon-lat (-60, -40) and ending at (20, 10)
 * const orthodrome = new Orthodrome(-60, -40, 20, 10);
 * // OR create from VectorPoints
 * const orthodrome = Orthodrome.fromPoints({ x: -60, y: -40 }, { x: 20, y: 10 });
 * // { x: -39.13793657428956, y: -33.72852197561652 }
 * const intermediatePoint = orthodrome.intermediatePoint(0.2);
 * // Distance in KM: 1.5514126949321814
 * const distance = orthodrome.distanceTo();
 * // get the bearing of the first point to the second in degrees
 * const bearing = orthodrome.bearing();
 * ```
 *
 * ## Links
 * - http://www.movable-type.co.uk/scripts/latlong.html
 */
export class Orthodrome {
  /** start longitude in radians */
  readonly lon1: number;
  /** start latitude in radians */
  readonly lat1: number;
  /** end longitude in radians */
  readonly lon2: number;
  /** end latitude in radians */
  readonly lat2: number;
  /** distance property */
  readonly a: number;
  /** distance property */
  readonly dist: number;
  /**
   * @param startLon - start longitude in degrees
   * @param startLat - start latitude in degrees
   * @param endLon - end longitude in degrees
   * @param endLat - end latitude in degrees
   */
  constructor(startLon: number, startLat: number, endLon: number, endLat: number) {
    const { sin, cos, atan2, sqrt } = Math;
    const lon1 = (this.lon1 = degToRad(startLon));
    const lat1 = (this.lat1 = degToRad(startLat));
    const lon2 = (this.lon2 = degToRad(endLon));
    const lat2 = (this.lat2 = degToRad(endLat));
    const dLat = lat2 - lat1;
    const dLon = lon2 - lon1;
    const a = (this.a =
      sin(dLat / 2) * sin(dLat / 2) + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2));
    this.dist = 2 * atan2(sqrt(a), sqrt(1 - a));
  }

  /**
   * Create an orthodrome from two points
   * @param p1 - start point
   * @param p2 - end point
   * @returns - orthodrome
   */
  static fromPoints(p1: LonLat, p2: LonLat): Orthodrome {
    return new Orthodrome(p1.x, p1.y, p2.x, p2.y);
  }

  /**
   * input t 0->1. Find a point along the orthodrome.
   * @param t - distance along the orthodrome to find
   * @returns [lon, lat]
   */
  intermediatePoint(t: number): LonLat {
    const { lon1, lon2, lat1, lat2, dist } = this;
    const { sin, cos, atan2, sqrt } = Math;

    // check corner cases first
    if (t === 0) return { x: radToDeg(lon1), y: radToDeg(lat1) };
    else if (t === 1) return { x: radToDeg(lon2), y: radToDeg(lat2) };
    // check if points are equal
    else if (lon1 === lon2 && lat1 === lat2) return { x: radToDeg(lon1), y: radToDeg(lat1) };

    const A = sin((1 - t) * dist) / sin(dist);
    const B = sin(t * dist) / sin(dist);

    const x = A * cos(lat1) * cos(lon1) + B * cos(lat2) * cos(lon2);
    const y = A * cos(lat1) * sin(lon1) + B * cos(lat2) * sin(lon2);
    const z = A * sin(lat1) + B * sin(lat2);

    const lat = atan2(z, sqrt(x * x + y * y));
    const lon = atan2(y, x);

    return { x: radToDeg(lon), y: radToDeg(lat) };
  }

  /**
   * @returns the bearing in degrees between the two points
   */
  bearing(): number {
    const { lon1, lat1, lon2, lat2 } = this;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    const angleRad = Math.atan2(y, x);

    return (radToDeg(angleRad) + 360) % 360; // in degrees
  }

  /**
   * Finds the distance between the two points in kilometers
   * projected normalized (0->1)
   * @returns - total distance between the two points
   */
  distanceTo(): number {
    const { a } = this;
    const { atan2, sqrt } = Math;

    return 2 * atan2(sqrt(a), sqrt(1 - a));
  }
}

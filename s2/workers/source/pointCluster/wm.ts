import PointIndex from './pointIndex.js';
import { Tile, convert, idLevel, idToIJ } from 'gis-tools/index.js';

import type { ClusterOptions } from './index.js';
import type { Point } from './pointIndex.js';
import type { Face, JSONCollection, VectorPointFeature } from 'gis-tools/index.js';

/** Comparison function - if true the features can be grouped */
export type Comparator = (a: VectorPointFeature, b: VectorPointFeature) => boolean;
/**
 * Default comparator
 * @param a - first feature
 * @param b - comparison feature
 * @returns true if the `metadata.layer`s are the same
 */
function defaultCmp(a: VectorPointFeature, b: VectorPointFeature): boolean {
  return a.metadata?.layer === b.metadata?.layer;
}

/** A clustered point */
export interface Cluster {
  // base means it's just a point feature, level means it's potentially a cluster, but just have a sum of 1 (still a point)
  ref: VectorPointFeature;
  visited: boolean;
  sum: number;
}

/** Options for point clustering that are filled with values */
export interface OptionsComputed {
  /** min zoom to generate clusters on */
  minzoom: number;
  /** max zoom level to cluster the points on */
  maxzoom: number;
  /** cluster radius in pixels */
  radius: number;
  /** tile extent (radius is calculated relative to it) */
  extent: number;
  /** size of the KD-tree leaf node, effects performance */
  nodeSize: number;
}

const DEFAULT_OPTIONS: OptionsComputed = {
  minzoom: 0, // min zoom to generate clusters on
  maxzoom: 16, // max zoom level to cluster the points on
  radius: 50, // cluster radius in pixels
  extent: 512, // tile extent (radius is calculated relative to it)
  nodeSize: 64, // size of the KD-tree leaf node, effects performance
};

/**
 * # Point Cluster
 *
 * A point cluster for Web Mercator tiles
 */
export default class PointCluser {
  minzoom: number;
  maxzoom: number;
  options: OptionsComputed = DEFAULT_OPTIONS;
  base: PointIndex<Cluster>;
  indexes: Array<PointIndex<Cluster>> = [];
  points: VectorPointFeature[] = [];
  faces = new Set<Face>([0]);
  projection = 'WM';
  /** @param options - cluster options */
  constructor(options: ClusterOptions = {}) {
    this.options = { ...this.options, ...options };
    this.minzoom = this.options.minzoom;
    this.maxzoom = this.options.maxzoom;
    this.base = new PointIndex<Cluster>(this.options.nodeSize);
    let i = this.options.minzoom;
    while (i <= this.options.maxzoom) {
      this.indexes.push(new PointIndex<Cluster>(this.options.nodeSize));
      i++;
    }
  }

  /**
   * Add a collection of points
   * @param data - a collection of points to add
   */
  addManyPoints(data: JSONCollection): void {
    const features = convert('WG', data, undefined, true);
    for (const feature of features) {
      const { type, coordinates } = feature.geometry;
      if (type === 'Point') {
        this.addPoint(feature as unknown as VectorPointFeature);
      } else if (type === 'MultiPoint') {
        for (const point of coordinates) {
          const { x: s, y: t, m } = point;
          this.addPoint({
            type: 'VectorFeature',
            geometry: { type: 'Point', is3D: false, coordinates: { x: s, y: t, m } },
          } as VectorPointFeature);
        }
      }
    }
  }

  /**
   * Add a single point
   * @param point - a point to add
   */
  addPoint(point: VectorPointFeature): void {
    const cluster: Cluster = { ref: point, visited: false, sum: 1 };
    this.base.add(point.geometry.coordinates.x, point.geometry.coordinates.y, cluster);
  }

  /**
   * Cluster the points
   * @param cmp - optional comparator function
   */
  cluster(cmp?: Comparator): void {
    if (cmp === undefined) cmp = defaultCmp;
    let zoom = this.options.maxzoom;

    while (zoom >= this.options.minzoom) {
      const currIndex = this.indexes[zoom];
      if (zoom === this.options.maxzoom) {
        this.#cluster(zoom, this.base, currIndex, cmp);
      } else {
        this.#cluster(zoom, this.indexes[zoom + 1], currIndex, cmp);
      }
      zoom--;
    }
  }

  /**
   * Get a tile from the point cluster
   * @param id - the tile id
   * @returns a tile filled with cluster points that are in the tile
   */
  getTile(id: bigint): Tile {
    const { radius, extent, maxzoom } = this.options;
    const level = idLevel(id);
    const [zoom, i, j] = idToIJ(id, level);
    const tile = new Tile(id);

    const index = zoom < maxzoom ? this.indexes[zoom] : this.base;
    const z2 = Math.pow(2, zoom);
    const p = radius / extent;
    const top = (j - p) / z2;
    const bottom = (j + 1 + p) / z2;

    const results: Array<Point<Cluster>> = [];
    results.push(...index.range((i - p) / z2, top, (i + 1 + p) / z2, bottom));
    if (i === 0) results.push(...index.range((z2 - p) / z2, top, 1, bottom));
    else if (i === z2 - 1.0) results.push(...index.range(0, top, (p + 1.0) / z2, bottom));

    // lastly, build features
    for (const cluster of results) {
      const { ref, sum } = cluster.data;
      // prep layer
      const layerName = (ref.metadata?.layer as string) ?? 'default';
      // prep feature
      tile.addFeature(
        {
          type: 'VectorFeature',
          geometry: {
            type: 'Point',
            is3D: false,
            coordinates: { x: cluster.x, y: cluster.y },
          },
          properties: { ...ref.properties, __cluster: sum > 1, __sum: sum },
        },
        layerName,
      );
    }
    tile.transform(0, this.maxzoom);

    return tile;
  }

  /**
   * Cluster the points
   * @param level - the zoom level
   * @param queryIndex - the query index
   * @param currIndex - the current index to store the resulting clusters to
   * @param cmp - the comparator
   */
  #cluster(
    level: number,
    queryIndex: PointIndex<Cluster>,
    currIndex: PointIndex<Cluster>,
    cmp: Comparator,
  ): void {
    const { extent } = this.options;
    const radius = this.options.radius / (extent * Math.pow(2, level));

    for (const cluster of queryIndex.points) {
      if (cluster.data.visited) continue;
      cluster.data.visited = true;

      // prep the new cluster data
      let sum = cluster.data.sum;
      let x = cluster.x * sum;
      let y = cluster.y * sum;

      // joining all points found within radius
      for (const foundPoint of queryIndex.radius(cluster.x, cluster.y, radius)) {
        if (foundPoint.data.visited || !cmp(foundPoint.data.ref, cluster.data.ref)) continue;
        // add the point to the new cluster
        x += foundPoint.x * foundPoint.data.sum;
        y += foundPoint.y * foundPoint.data.sum;
        sum += foundPoint.data.sum;
        foundPoint.data.visited = true;
      }

      // create the new point and add it to the current index
      const newClusterPoint: Point<Cluster> = {
        x: x / sum,
        y: y / sum,
        data: { ref: cluster.data.ref, visited: false, sum },
      };
      currIndex.addPoint(newClusterPoint);
    }
  }
}

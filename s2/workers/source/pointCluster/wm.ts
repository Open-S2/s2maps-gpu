import PointIndex from './pointIndex';
import { convert } from 'gis-tools';
import { fromID } from 'geometry/wm';
import { transformPoint } from '../jsonVT/transform';

import type { ClusterOptions } from './';
import type { Point } from './pointIndex';
import type { Face, JSONCollection, VectorPointGeometry } from 'gis-tools';

/**
 *
 */
export type Comparator = (a: VectorPointGeometry, b: VectorPointGeometry) => boolean;

/**
 *
 */
export interface Cluster {
  // base means it's just a point feature, level means it's potentially a cluster, but just have a sum of 1 (still a point)
  ref: VectorPointGeometry;
  visited: boolean;
  sum: number;
}

/**
 *
 */
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
 *
 */
export default class PointCluser {
  minzoom: number;
  maxzoom: number;
  options: OptionsComputed = DEFAULT_OPTIONS;
  base: PointIndex<Cluster>;
  indexes: Array<PointIndex<Cluster>> = [];
  points: VectorPointGeometry[] = [];
  faces = new Set<Face>([0]);
  projection = 'WG';
  /**
   * @param options
   */
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
   * @param data
   */
  addManyPoints(data: JSONCollection): void {
    const features = convert('WG', data, undefined, true);
    for (const { geometry, properties } of features) {
      const { type, coordinates } = geometry;
      if (type === 'Point') {
        this.addPoint(geometry);
      } else if (type === 'MultiPoint') {
        for (const point of coordinates) {
          const { x: s, y: t, m } = point;
          this.addPoint();
        }
      }
    }
  }

  /**
   * @param point
   */
  addPoint(point: VectorPointGeometry): void {
    const cluster: Cluster = { ref: point, visited: false, sum: 1 };
    this.base.add(point.coordinates[0], point.geometry.coordinates[1], cluster);
  }

  /**
   * @param cmp
   */
  cluster(cmp?: Comparator): void {
    if (cmp === undefined)
      /**
       *
       */
      cmp = () => true;
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
   * @param id
   */
  getTile(id: bigint): JSONVectorTile {
    const { radius, extent, maxzoom } = this.options;
    const [zoom, i, j] = fromID(id);

    const index = zoom < maxzoom ? this.indexes[zoom] : this.base;
    const z2 = Math.pow(2, zoom);
    const p = radius / extent;
    const top = (j - p) / z2;
    const bottom = (j + 1 + p) / z2;

    const results: Array<Point<Cluster>> = [];
    results.push(...index.range((i - p) / z2, top, (i + 1 + p) / z2, bottom));
    if (i === 0) results.push(...index.range((z2 - p) / z2, top, 1, bottom));
    else if (i === z2 - 1.0) results.push(...index.range(0, top, (p + 1.0) / z2, bottom));

    // lastly, build a JSONVectorTile
    const layers: JSONLayers = {};
    for (const cluster of results) {
      const { ref, sum } = cluster.data;
      // prep layer
      const layerName = (ref.properties.__layer as string) ?? 'default';
      if (layers[layerName] === undefined)
        layers[layerName] = { extent: 8_192, features: [], length: 0 };
      const layer = layers[layerName];
      // prep feature
      const pointFeature: JSONVectorPointsFeature = {
        type: 1,
        extent: 8_192,
        geometry: [transformPoint(cluster.x, cluster.y, 8_192, 1 << zoom, i, j)],
        properties: { ...ref.properties, __cluster: sum > 1, __sum: sum },
        loadGeometryFlat: undefined,
      };
      // store
      layer.features.push(pointFeature);
      layer.length++;
    }

    return {
      face: 0,
      zoom,
      i,
      j,
      extent,
      layers,
    };
  }

  /**
   * @param level
   * @param queryIndex
   * @param currIndex
   * @param cmp
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

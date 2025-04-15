export { default as PointIndex } from './pointIndex';
// export { default as S2PointCluster } from './s2'
export { default as WMPointCluster } from './wm';

/** Options for point clustering */
export interface ClusterOptions {
  /** min zoom to generate clusters on */
  minzoom?: number;
  /** max zoom level to cluster the points on */
  maxzoom?: number;
  /** cluster radius in pixels */
  radius?: number;
  /** tile extent (radius is calculated relative to it) */
  extent?: number;
  /** size of the KD-tree leaf node, effects performance */
  nodeSize?: number;
}

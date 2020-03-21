// @flow

export interface Projection {
  translation: Float32Array; // [x, y, z]
  zTranslateStart?: number;
  zTranslateEnd?: number;
  zoomEnd?: number;
  rotation: [number, number, number];
  zoom: number;
  scale: number;
  zNear: number;
  zFar: number;
  aspect: Float32Array; // [width, height]

  resize(width: number, height: number): null;
  setZoom(zoom: number): null;
  onZoom(zoom: number): null;
  setLonLat(lon: number, lat: number): null;
  onMove(rotation: [number, number, number]): null;
  getMatrixAtSize(size: number): Float32Array;
  getMatrix(tile: Tile): Float32Array;
  getTilesInView(): Array<[number, number, number, number, number]>;
}

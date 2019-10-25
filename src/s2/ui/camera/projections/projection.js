// @flow

export interface Projection {
  translation?: [number, number, number];
  zTranslateStart?: number;
  zTranslateEnd?: number;
  zoomEnd?: number;
  rotation?: [number, number, number];
  zoom?: number;
  scale?: number;
  zNear?: number;
  zFar?: number;
  width?: number;
  height?: number;

  resize(width: number, height: number): null;
  setZoom(zoom: number): null;
  onZoom(zoom: number): null;
  setLonLat(lon: number, lat: number): null;
  onMove(rotation: [number, number, number]): null;
  getMatrix(tileSize: number): Float32Array;
  getTilesInView(): Array<[number, number, number, number, number]>;
}

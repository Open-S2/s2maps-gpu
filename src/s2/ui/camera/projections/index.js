// @flow
import * as mat4 from '../../../util/mat4'
import { default as getTiles } from './getTilesInView'
import { S2Point } from 's2projection'

export type ProjectionConfig = {
  eye?: [number, number, number],
  maxLatRotation?: number,
  zoom?: number,
  minzoom?: number,
  maxzoom?: number,
  lon?: number,
  lat?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number,
  canvasMultiplier: number
}

export type TileDefinition = [number, number, number, number, number]
export type TileDefinitions = Array<TileDefinition>

export type MatrixType = 'm' | 'km' // meters of kilometers

// const EARTH_RADIUS = 6_371_008.8 // meters

export default class Projector {
  radius: number = 6_371.0088
  radii: number = [6378137, 6356752.3, 6378137]
  zTranslateStart: number = 5
  zTranslateEnd: number = 1.001
  zoomEnd: number = 5
  view: Float32Array = new Float32Array(16) // [zoom, lon, lat, angle, pitch, time, featureState, currFeature, ...extensions]
  aspect: Float32Array = new Float32Array([400, 300]) // default canvas width x height
  matrices: { [MatrixType]: Float32Array } = {}
  eye: [number, number, number] = [0, 0, 0] // [x, y, z] only z should change for visual effects
  maxLatRotation: number = 85 // deg
  prevZoom: number = 0
  zoom: number = -1
  minzoom: number = 0
  maxzoom: number = 20
  lon: number = -1
  lat: number = -1
  pitch: number = 0
  zNear: number = 0.5 // static; just for draw calls
  zFar: number = 100_000_000 // static; just for draw calls
  multiplier: number = 1
  dirty: boolean = true
  constructor (config: MapOptions) {
    const { style } = config
    if (style.maxLatRotation) this.maxLatRotation = style.maxLatRotation
    const zoom = style.zoom | 0
    const center = (style.center && Array.isArray(style.center)) ? style.center : [0, 0]
    this.setPosition(...center, zoom)
    if (style.zNear) this.zNear = style.zNear
    if (style.zFar) this.zFar = style.zFar
    if (config.canvasMultiplier) this.multiplier = config.canvasMultiplier
  }

  setFeatureState (state: 0 | 1 | 2) {
    this.view[6] = state
  }

  setCurrentFeature (id: number) {
    this.view[7] = id
  }

  setStyleParameters (style, ignorePosition: boolean) {
    const { minzoom, maxzoom, zoom, lon, lat } = style
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -10) ? -10 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 29) ? 29 : minzoom
    this.maxzoom = (maxzoom > 30) ? 30 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    // set position
    if (!ignorePosition) this.setPosition(lon, lat, zoom)
    else { this.matrices = {}; this.dirty = true } // ensure this projector is dirty (incase of ignorePosition === true)
  }

  setPosition (lon: number, lat: number, zoom: number) {
    // set lon lat
    this.setLonLat(lon, lat)
    // set zoom
    this.setZoom(zoom)
  }

  zoomChange (): number {
    const { zoom, prevZoom } = this
    const { floor } = Math
    return floor(zoom) - floor(prevZoom)
  }

  resize (width: number, height: number) {
    this.aspect[0] = width
    this.aspect[1] = height
    this.matrices = {}
    this.dirty = true
  }

  setZoom (zoom: number) {
    if (this.zoom !== zoom) {
      this.zoom = zoom
      this.view[0] = this.zoom
      this.onZoom()
    }
  }

  onZoom (zoomInput?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    const { prevZoom, minzoom, maxzoom } = this
    // const { prevZoom, minzoom, maxzoom } = this
    if (this.zoom > maxzoom) {
      this.zoom = maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (prevZoom === maxzoom) return false
    } else if (this.zoom < minzoom) {
      this.zoom = minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (prevZoom === minzoom) return false
    }
    const { zoom } = this
    // update view
    this.view[0] = zoom
    // cleanup
    this.matrices = {}
    this.dirty = true
    return true
  }

  onMove (movementX?: number = 0, movementY?: number = 0, multiplierX?: number = 3, multiplierY?: number = 3) {
    const { lat, zoom, maxLatRotation } = this
    const zoomMultiplier = 2 * Math.pow(2, Math.max(zoom, 0))
    const latMultiplier = 1.25 / maxLatRotation * Math.abs(lat) + 1 // if we are near the poles, we don't want to *feel* slowed down
    if (movementX) this.lon -= movementX / (multiplierX * zoomMultiplier) * latMultiplier
    if (movementY) this.lat += movementY / (multiplierY * zoomMultiplier)
    // check that we don't over move on the x axis
    if (this.lat > maxLatRotation) this.lat = maxLatRotation
    else if (this.lat < -maxLatRotation) this.lat = -maxLatRotation
    // update view
    this.view[1] = this.lon
    this.view[2] = this.lat
    // if we hit 360, just swing back to 0
    while (this.lon >= 360) { this.lon -= 360 }
    while (this.lon <= 0) { this.lon += 360 }
    // cleanup
    this.matrices = {}
    this.dirty = true
  }

  setLonLat (lon: number, lat: number) {
    if (this.lon !== lon && this.lat !== lat) {
      this.lon = lon
      this.lat = lat
      this.onMove()
    }
  }

  getMatrix (type: MatrixType): Float32Array {
    if (this.matrices[type]) return mat4.clone(this.matrices[type])
    // update eye
    this._updateEye()
    // get perspective matrix
    let matrix = this._getProjectionMatrix(type)
    // create view matrix
    const view = mat4.lookAt(this.eye, [0, 1, 0])
    // if km we "remove" the eye
    if (type === 'km') { view[12] = 0; view[13] = 0; view[14] = 0 }
    // multiply perspective matrix by view matrix
    matrix = mat4.multiply(matrix, view)
    // updated matrix
    this.matrices[type] = matrix

    return mat4.clone(matrix)
  }

  _updateEye () {
    const { lon, lat, zoom, radius, zTranslateEnd, zTranslateStart, zoomEnd } = this
    // find radial distance from core of ellipsoid
    const radialMultiplier = Math.max(
      (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
      zTranslateEnd
    ) * radius
    // create xyz point for eye
    const s2Point = S2Point.fromLonLatGL(lon, lat).normalize().mul(radialMultiplier)
    // set the eye
    this.eye = [s2Point.x, s2Point.y, s2Point.z]
  }

  _getProjectionMatrix (type: MatrixType): Float32Array {
    let { zoom, radius, aspect, multiplier } = this
    let multpl
    // prep a matrix
    const matrix = mat4.create()

    // BLEND LOOKS A BIT DIFF const multpl = -radius / multiplier / (tileSize * scale * radius * 5)
    if (type === 'km') {
      radius *= 1000
      // multpl = radius / multiplier / (768 * Math.pow(2, 12 - zoom))
      multpl = radius / multiplier / (768 * Math.pow(2, zoom))
    } else { // case of any zoom less then 12
      multpl = radius / multiplier / (768 * Math.pow(2, zoom))
    }

    // create projection
    // mat4.blend(matrix, aspect[0] * multpl, aspect[1] * multpl, 0.5, zFar)
    mat4.ortho(matrix, aspect[0] * multpl, aspect[1] * multpl, 100_000)

    return matrix
  }

  getTilesInView (): TileDefinitions { // [face, zoom, x, y, hash]
    let { radius, zoom, lon, lat } = this
    const matrix = this.getMatrix('m')
    return getTiles(zoom, matrix, lon, lat, radius)
  }
}

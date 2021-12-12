// @flow
import * as mat4 from '../../../util/mat4'
import getTiles from './getTilesInView'
import _cursorToLonLat from './cursorToLonLat'
import { fromLonLatGL, normalize, mul } from '../../../geo/S2Point'

import type { Face } from '../../../style/styleSpec'
import type { MapOptions } from '../../map'

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

export type TileDefinitions = Array<[Face, number, number, number, BigInt]> // [face, zoom, i, j, id]

export type MatrixType = 'm' | 'km' // meters of kilometers

// haversine / great circle distance -> http://www.movable-type.co.uk/scripts/latlong.html

export default class Projector {
  radius: number = 6_371.0088
  radii: number = [6378137, 6356752.3, 6378137]
  zTranslateStart: number = 5
  zTranslateEnd: number = 1.001
  zoomEnd: number = 5
  positionalZoom: boolean = true
  view: Float32Array = new Float32Array(16) // [zoom, lon, lat, bearing, pitch, time, featureState, currFeature, ...extensions]
  aspect: Float32Array = new Float32Array([400, 300]) // default canvas width x height
  matrices: { [MatrixType]: Float32Array } = {}
  eye: [number, number, number] = [0, 0, 0] // [x, y, z] only z should change for visual effects
  maxLatRotation: number = 89.99999 // deg
  prevZoom: number = 0
  zoom: number = -1
  minzoom: number = 0
  maxzoom: number = 20
  zoomOffset: number = 0
  lon: number = -1
  lat: number = -1
  bearing: number = 0
  pitch: number = 0
  zNear: number = 0.5 // static; just for draw calls
  zFar: number = 100_000_000 // static; just for draw calls
  tileSize: number = 768
  multiplier: number = 1
  dirty: boolean = true
  constructor (config: MapOptions) {
    const { style } = config
    if (!isNaN(style.maxLatRotation)) this.maxLatRotation = Math.min(style.maxLatRotation, this.maxLatRotation)
    const zoom = style.zoom | 0
    const center = (style.center && Array.isArray(style.center)) ? style.center : [0, 0]
    this.setPosition(...center, zoom)
    if (!isNaN(style.bearing)) this.bearing = style.bearing
    if (!isNaN(style.pitch)) this.pitch = style.pitch
    if (style.zNear) this.zNear = style.zNear
    if (style.zFar) this.zFar = style.zFar
    if (config.canvasMultiplier) this.multiplier = config.canvasMultiplier
    if (config.positionalZoom === false) this.positionalZoom = false
  }

  /* API */

  setFeatureState (state: 0 | 1 | 2) {
    this.view[6] = state
  }

  setCurrentFeature (id: number) {
    this.view[7] = id
  }

  setStyleParameters (style, ignorePosition: boolean) {
    const { minzoom, maxzoom, zoom, lon, lat } = style
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -2) ? -2 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 19) ? 19 : minzoom
    this.maxzoom = (maxzoom > 20) ? 20 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    this.zoomOffset = style.zoomOffset
    // set position
    this.setPosition((!ignorePosition) ? lon : this.lon, (!ignorePosition) ? lat : this.lat, zoom)
  }

  setPosition (lon: number, lat: number, zoom?: number, bearing?: number, pitch?: number) {
    // set lon lat
    this.setLonLat(lon, lat)
    // set zoom
    if (!isNaN(zoom)) this.setZoom(zoom)
    // set bearing
    if (!isNaN(bearing)) this.setBearing(bearing)
    // set pitch
    if (!isNaN(pitch)) this.setPitch(pitch)
  }

  setLonLat (lon: number, lat: number) {
    if (this.lon !== lon || this.lat !== lat) {
      this.lon = lon
      this.lat = lat
      this._adjustLonLat()
    }
  }

  addBearing (num: number) {
    this.setBearing(this.bearing + num)
  }

  setBearing (bearing: number) {
    if (this.bearing !== bearing) {
      this.bearing = bearing
      // if we hit greater than 180, just swing back to 0
      while (this.bearing >= 180) { this.bearing -= 360 }
      while (this.bearing < -180) { this.bearing += 360 }
      // cleanup
      this.matrices = {}
      this.dirty = true
    }
  }

  setPitch (pitch: number) {
    if (this.pitch !== pitch) {
      this.pitch = pitch
      // cleanup
      this.matrices = {}
      this.dirty = true
    }
  }

  zoomChange (): number {
    const { zoom, prevZoom } = this
    const { floor } = Math
    return floor(zoom) - floor(prevZoom)
  }

  zoomScale (zoom: number): number {
    return Math.pow(2, zoom)
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

  clampZoom (input: number) {
    const { minzoom, maxzoom } = this
    return Math.max(Math.min(input, maxzoom), minzoom)
  }

  onZoom (zoomInput?: number = 0, canvasX?: number = 0, canvasY?: number = 0): boolean {
    const { positionalZoom, multiplier, aspect } = this
    const { abs, pow, max, min, cos, PI } = Math
    // adjust the zoom
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    const { prevZoom, minzoom, maxzoom } = this
    if (this.zoom > maxzoom) {
      this.zoom = maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (prevZoom === maxzoom) return false
    } else if (this.zoom < minzoom) {
      this.zoom = minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (prevZoom === minzoom) return false
    }
    // if positionalZoom, we adjust the lon and lat according to the mouse position.
    // consider the distance between the lon-lat of our current "center" position and
    // the lon-lat of the cursor position PRE-zoom adjustment. After zooming, we
    // want to readjust our lon-lat position to compensate for that delta.
    if (positionalZoom && canvasX && canvasY) {
      // STEP 1: Get the distance from the center in pixels (up is +y, right is +x)
      // this value is considered our "previous" distance metric.
      const [width, height] = aspect
      const posX = canvasX - (width / multiplier / 2)
      const posY = (height / multiplier / 2) - canvasY
      // STEP 2: find the distance POST-zoom adjustment. In other words,
      // multiply the previous position by the scale change
      const zoomAdjust = 1 + (this.zoom - this.prevZoom)
      const posDeltaX = posX * zoomAdjust - posX
      const posDeltaY = posY * zoomAdjust - posY
      // STEP 3: The deltas need to be converted to deg change
      const zScale = pow(2, max(this.zoom, 0)) // we don't use the same zoom scale because less than 0 zoom should stay the same here
      const lonMultiplier = min(30, 1 / cos(abs(this.lat) * PI / 180))
      this.lon += posDeltaX / (3072 * zScale) * 360 * lonMultiplier
      this.lat += posDeltaY / (1536 * zScale) * 180
    }
    // adjust latitude accordingly
    this._adjustLonLat()
    // update view
    this.view[0] = this.zoom
    this.view[1] = this.lon
    this.view[2] = this.lat
    // cleanup
    this.matrices = {}
    this.dirty = true
    return true
  }

  onMove (movementX?: number = 0, movementY?: number = 0, multiplierX?: number = 3, multiplierY?: number = 3) {
    const { lat, zoom } = this
    const { abs, pow, max, min, cos, PI } = Math
    const zoomMultiplier = 2 * pow(2, max(zoom, 0))
    // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
    const lonMultiplier = min(30, 1 / cos(abs(lat) * PI / 180))
    if (movementX) this.lon -= movementX * lonMultiplier / (multiplierX * zoomMultiplier)
    if (movementY) this.lat += movementY / (multiplierY * zoomMultiplier)
    // adjust latitude accordingly
    this._adjustLonLat()
    // update view
    this.view[1] = this.lon
    this.view[2] = this.lat
    // cleanup
    this.matrices = {}
    this.dirty = true
  }

  getMatrix (type: MatrixType): Float32Array {
    if (this.matrices[type]) return mat4.clone(this.matrices[type])
    // update eye
    this._updateEye()
    // get perspective matrix
    let matrix = this._getProjectionMatrix(type)
    // create view matrix
    const view = mat4.lookAt(this.eye, [0, 1, 0])
    // if (this.bearing) mat4.rotateZ(matrix, degToRad(this.bearing))
    // if km we "remove" the eye
    if (type === 'km') { view[12] = 0; view[13] = 0; view[14] = 0 }
    // multiply perspective matrix by view matrix
    matrix = mat4.multiply(matrix, view)
    // updated matrix
    this.matrices[type] = matrix

    return mat4.clone(matrix)
  }

  // x and y are the distances from the center of the screen
  cursorToLonLat (x: number, y: number) {
    const { lon, lat, zoom, tileSize } = this
    return _cursorToLonLat(lon, lat, x, y, (tileSize * Math.pow(2, zoom)) / 2)
  }

  getTilesInView (): TileDefinitions { // Array<BigInt> (S2CellIDs)
    const { radius, zoom, zoomOffset, lon, lat } = this
    const matrix = this.getMatrix('m')
    return getTiles(zoom + zoomOffset, matrix, lon, lat, radius)
  }

  /* INTERNAL FUNCTIONS */

  _adjustLonLat () {
    const { zoom, maxLatRotation } = this
    const { min } = Math
    // ensure we hit a limit on latitude so we don't flip movement
    const curMaxLat = min(75 + min(14.999999, (14.999999 / 5) * zoom), maxLatRotation)
    if (this.lat > curMaxLat) this.lat = curMaxLat
    else if (this.lat < -curMaxLat) this.lat = -curMaxLat
    // lon wrap fixes
    while (this.lon >= 180) { this.lon -= 360 }
    while (this.lon < -180) { this.lon += 360 }
  }

  _updateEye () {
    const { lon, lat, zoom, radius, zTranslateEnd, zTranslateStart, zoomEnd } = this
    // find radial distance from core of ellipsoid
    const radialMultiplier = Math.max(
      (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
      zTranslateEnd
    ) * radius
    // create xyz point for eye
    this.eye = mul(normalize(fromLonLatGL(lon, lat)), radialMultiplier)
  }

  _getProjectionMatrix (type: MatrixType): Float32Array {
    let { zoom, radius, aspect, tileSize, multiplier } = this
    // prep a matrix
    const matrix = mat4.create()

    // BLEND LOOKS A BIT DIFF const multpl = -radius / multiplier / (tileSize * scale * radius * 5)
    if (type === 'km') radius *= 1000
    const multpl = radius / multiplier / (tileSize * Math.pow(2, zoom))

    // create projection
    mat4.ortho(matrix, aspect[0] * multpl, aspect[1] * multpl, 100_000)

    return matrix
  }
}

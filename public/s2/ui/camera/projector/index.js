// @flow
/* eslint-env browser */
import * as mat4 from '../../../util/mat4'
import getTiles from './getTilesInView'
import _cursorToLonLat from './cursorToLonLat'
import { fromLonLatGL, normalize, mul } from '../../../geo/S2Point'
import { degToRad } from '../../../geo/util'

import type { Face } from '../../../style/styleSpec'
import type { MapOptions } from '../../map'

export type ProjectionConfig = {
  eye?: [number, number, number],
  minLatPosition?: number,
  maxLatPosition?: number,
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

export default class Projector {
  map: Map
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
  minLatPosition: number = 70
  maxLatPosition: number = 89.99999 // deg
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
  constructor (config: MapOptions, map: Map) {
    const { canvasMultiplier, positionalZoom, webworker } = config
    if (canvasMultiplier) this.multiplier = canvasMultiplier
    if (positionalZoom === false) this.positionalZoom = false
    if (webworker) this.webworker = true
    this.map = map
  }

  /* API */

  reset () {
    if (!this.dirty) {
      this.dirty = true
      this.matrices = {}
    }
  }

  setFeatureState (state: 0 | 1 | 2) {
    this.view[6] = state
  }

  setCurrentFeature (id: number) {
    this.view[7] = id
  }

  setStyleParameters (style, ignorePosition: boolean) {
    const { min, max } = Math
    const {
      minLatPosition, maxLatPosition, minzoom, maxzoom, zoomOffset,
      zoom, lon, lat, bearing, pitch, zNear, zFar
    } = style
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -2) ? -2 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 19) ? 19 : minzoom
    this.maxzoom = (maxzoom > 20) ? 20 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    if (!isNaN(zoomOffset)) this.zoomOffset = zoomOffset
    if (!isNaN(maxLatPosition)) this.maxLatPosition = min(maxLatPosition, this.maxLatPosition)
    if (!isNaN(minLatPosition)) this.minLatPosition = max(minLatPosition, this.minLatPosition)
    this.setCompass(bearing, pitch)
    if (zNear) this.zNear = zNear
    if (zFar) this.zFar = zFar
    // set position
    this.setPosition((!ignorePosition) ? lon : this.lon, (!ignorePosition) ? lat : this.lat, zoom)
  }

  setPosition (lon: number, lat: number, zoom?: number, bearing?: number, pitch?: number) {
    // set lon lat
    this._setLonLat(lon, lat)
    // set zoom
    if (!isNaN(zoom)) this._setZoom(zoom)
    // set bearing & pitch
    this.setCompass(bearing, pitch)
  }

  setLonLat (lon: number, lat: number) {
    this._setLonLat(lon, lat)
  }

  setZoom (zoom: number) {
    this._setZoom(zoom)
  }

  setCompass (bearing?: number, pitch?: number) {
    let update = 0
    // set bearing & pitch
    if (!isNaN(bearing)) update |= this._setBearing(bearing)
    // set pitch
    if (!isNaN(pitch)) update |= this._setPitch(pitch)
    // if update we let the map know
    if (update) {
      const { bearing, pitch } = this
      if (this.webworker) postMessage({ type: 'updateCompass', bearing, pitch })
      else this.map.parent._updateCompass(bearing, pitch)
    }
  }

  zoomChange (): number {
    const { zoom, prevZoom } = this
    const { floor } = Math
    return floor(zoom) - floor(prevZoom)
  }

  zoomScale (zoom: number): number {
    if (!zoom) zoom = this.zoom
    return Math.pow(2, zoom)
  }

  clampLat (input: number) {
    const { maxLatPosition, minLatPosition, zoom } = this
    const { min, max } = Math
    // prep current boundaries
    const latPosDiff = maxLatPosition - minLatPosition
    const curMaxLat = min(minLatPosition + min(latPosDiff, (latPosDiff / 3) * zoom), maxLatPosition)
    // clamp
    return max(min(curMaxLat, input), -curMaxLat)
  }

  clampZoom (input: number) {
    const { minzoom, maxzoom } = this
    return Math.max(Math.min(input, maxzoom), minzoom)
  }

  clampDeg (input: number) {
    while (input >= 180) { input -= 360 }
    while (input < -180) { input += 360 }
    return input
  }

  resize (width: number, height: number) {
    this.aspect[0] = width
    this.aspect[1] = height
    // cleanup
    this.reset()
  }

  // user scrolled
  onZoom (zoomInput: number, canvasX?: number = 0, canvasY?: number = 0) {
    const { positionalZoom, multiplier, aspect } = this
    // set zoom
    this._setZoom(this.zoom - (0.003 * zoomInput))
    if (this.prevZoom === this.zoom) return
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
      this.onMove(-posDeltaX, posDeltaY, 3072, 1536)
    }
  }

  // user mouse/touch input (or swipe animation)
  onMove (movementX?: number = 0, movementY?: number = 0, multiplierX?: number = 6.5 * 360, multiplierY?: number = 6.5 * 180) {
    let { lon, lat, bearing } = this
    const { abs, max, min, cos, sin, PI } = Math
    const zScale = max(this.zoomScale(), 1)
    // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
    const lonMultiplier = min(30, 1 / cos(abs(this.lat) * PI / 180))
    // adjust movement vector if bearing
    if (bearing) {
      bearing = degToRad(bearing) // adjust to radians
      const tmpY = movementX * sin(bearing) + movementY * cos(bearing)
      movementX = movementX * cos(bearing) - movementY * sin(bearing)
      movementY = tmpY
    }
    // set the new lon-lat
    this._setLonLat(
      lon - (movementX / (multiplierX * zScale) * 360 * lonMultiplier),
      lat + (movementY / (multiplierY * zScale) * 180)
    )
  }

  // x and y are the distances from the center of the screen
  cursorToLonLat (x: number, y: number) {
    const { lon, lat, zoom, tileSize } = this
    return _cursorToLonLat(lon, lat, x, y, (tileSize * Math.pow(2, zoom)) / 2)
  }

  getMatrix (type: MatrixType): Float32Array {
    if (this.matrices[type]) return mat4.clone(this.matrices[type])
    // updated matrix
    const matrix = this.matrices[type] = this._getMatrix(type)

    return mat4.clone(matrix)
  }

  getTilesInView (): TileDefinitions { // Array<BigInt> (S2CellIDs)
    const { radius, zoom, zoomOffset, lon, lat } = this
    const matrix = this.getMatrix('m')
    return getTiles(zoom + zoomOffset, matrix, lon, lat, radius)
  }

  getTilesAtPosition (lon: number, lat: number, zoom: number, bearing: number, pitch: number): TileDefinitions { // Array<BigInt> (S2CellIDs)
    const { radius, zoomOffset } = this
    const matrix = this._getMatrix('m', false, lon, lat, zoom, bearing, pitch)
    return getTiles(zoom + zoomOffset, matrix, lon, lat, radius)
  }

  /* INTERNAL FUNCTIONS */

  _setLonLat (lon: number, lat: number) {
    lon = this.clampDeg(lon)
    lat = this.clampLat(lat)
    if (this.lon !== lon || this.lat !== lat) {
      this.lon = lon
      this.lat = lat
      // update view
      this.view[1] = this.lon
      this.view[2] = this.lat
      // cleanup for next render
      this.reset()
    }
  }

  _setZoom (zoom: number) {
    zoom = this.clampZoom(zoom)
    if (this.zoom !== zoom || this.prevZoom !== zoom) {
      // keep track of the old zoom
      this.prevZoom = this.zoom
      // adjust the zoom
      this.zoom = zoom
      // update view
      this.view[0] = this.zoom
      // cleanup for next render
      this.reset()
    }
  }

  _setBearing (bearing: number): boolean {
    bearing = this.clampDeg(bearing)
    if (this.bearing !== bearing) {
      this.bearing = bearing
      // cleanup for next render
      this.reset()
      return true
    }
    return false
  }

  _setPitch (pitch: number): boolean {
    if (this.pitch !== pitch) {
      this.pitch = pitch
      // cleanup for next render
      this.reset()
      return true
    }
    return false
  }

  _getMatrix (type: MatrixType, updateEye?: boolean = true, lon?: number,
    lat?: number, zoom?: number, bearing?: number, pitch?: number): Float32Array {
    if (isNaN(lon)) lon = this.lon
    if (isNaN(lat)) lat = this.lat
    if (isNaN(zoom)) zoom = this.zoom
    if (isNaN(bearing)) bearing = this.bearing
    if (isNaN(pitch)) pitch = this.pitch
    // update eye
    const eye = this._updateEye(updateEye, lon, lat, zoom)
    // get perspective matrix
    let matrix = this._getProjectionMatrix(type, zoom)
    // create view matrix
    const view = mat4.lookAt(eye, [0, 1, 0])
    // adjust by bearing
    if (bearing) mat4.rotateZ(matrix, degToRad(bearing))
    // if km we "remove" the eye
    if (type === 'km') { view[12] = 0; view[13] = 0; view[14] = 0 }
    // multiply perspective matrix by view matrix
    matrix = mat4.multiply(matrix, view)

    return matrix
  }

  _updateEye (update?: boolean = true, lon: number, lat: number, zoom: number): [number, number, number] {
    const { radius, zTranslateEnd, zTranslateStart, zoomEnd } = this
    // find radial distance from core of ellipsoid
    const radialMultiplier = Math.max(
      (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
      zTranslateEnd
    ) * radius
    // create xyz point for eye
    const eye = mul(normalize(fromLonLatGL(lon, lat)), radialMultiplier)
    if (update) this.eye = mul(normalize(fromLonLatGL(lon, lat)), radialMultiplier)

    return eye
  }

  _getProjectionMatrix (type: MatrixType, zoom?: number): Float32Array {
    let { radius, aspect, tileSize, multiplier } = this
    if (isNaN(zoom)) zoom = this.zoom
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

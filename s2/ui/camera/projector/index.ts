/* eslint-env browser */
import Camera from '..'
import * as mat4 from './mat4'
import getTiles from './getTilesInView'
import _cursorToLonLat from './cursorToLonLat'
import { fromLonLatGL, mul, normalize } from 's2projection/s2Point'
import { degToRad } from 's2projection/util'

import type { MapOptions } from '../../s2mapUI'

export interface ProjectionConfig {
  minLatPosition?: number
  maxLatPosition?: number
  zoom?: number
  minzoom?: number
  maxzoom?: number
  center?: [number, number]
  zNear?: number
  zFar?: number
  bearing?: number
  pitch?: number
  noClamp?: boolean
  zoomOffset?: number
}

export type MatrixType = 'm' | 'km' // meters or kilometers

export default class Projector {
  camera: Camera
  webworker = false
  noClamp = false
  radius = 6_371.0088
  radii: [number, number, number] = [6378137, 6356752.3, 6378137]
  zTranslateStart = 5
  zTranslateEnd = 1.001
  zoomEnd = 5
  positionalZoom = true
  view: number[] = new Array(16) // [zoom, lon, lat, bearing, pitch, time, featureState, currFeature, ...extensions]
  aspect: number[] = [400, 300] // default canvas width x height
  matrices: { [key in MatrixType]?: Float32Array } = {}
  eye: [number, number, number] = [0, 0, 0] // [x, y, z] only z should change for visual effects
  minLatPosition = 70
  maxLatPosition = 89.99999 // deg
  prevZoom = 0
  zoom = -1
  minzoom = 0
  maxzoom = 20
  zoomOffset = 0
  lon = -1
  lat = -1
  bearing = 0
  pitch = 0
  zNear = 0.5 // static; just for draw calls
  zFar = 100_000_000 // static; just for draw calls
  tileSize = 768
  multiplier = 1
  dirty = true
  constructor (config: MapOptions, camera: Camera) {
    const { canvasMultiplier, positionalZoom, webworker, noClamp } = config
    if (canvasMultiplier !== undefined) this.multiplier = canvasMultiplier
    if (positionalZoom === false) this.positionalZoom = false
    if (webworker === true) this.webworker = true
    if (noClamp === true) this.noClamp = true
    this.camera = camera
  }

  /* API */

  reset (): void {
    if (!this.dirty) {
      this.dirty = true
      this.matrices = {}
    }
  }

  setFeatureState (state: 0 | 1 | 2): void {
    this.view[6] = state
    this.dirty = true
  }

  setCurrentFeature (id: number): void {
    this.view[7] = id
    this.dirty = true
  }

  setStyleParameters (config: ProjectionConfig, ignorePosition: boolean): void {
    const { min, max } = Math
    const {
      noClamp, minLatPosition, maxLatPosition, zoomOffset,
      zoom, center, bearing, pitch, zNear, zFar
    } = config
    const [lon, lat] = center ?? [this.lon, this.lat]
    const maxzoom = config.maxzoom ?? this.maxzoom
    const minzoom = config.minzoom ?? this.minzoom
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -2) ? -2 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 19) ? 19 : minzoom
    this.maxzoom = (maxzoom > 20) ? 20 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    if (zoomOffset !== undefined) this.zoomOffset = zoomOffset
    if (maxLatPosition !== undefined) this.maxLatPosition = min(maxLatPosition, this.maxLatPosition)
    if (minLatPosition !== undefined) this.minLatPosition = max(minLatPosition, this.minLatPosition)
    if (noClamp === true) this.noClamp = true
    if (zNear !== undefined) this.zNear = zNear
    if (zFar !== undefined) this.zFar = zFar
    // set position
    if (!ignorePosition) this.setPosition(lon, lat, zoom, bearing, pitch)
  }

  setPosition (lon: number, lat: number, zoom?: number, bearing?: number, pitch?: number): void {
    // set lon lat
    this.#setLonLat(lon, lat)
    // set zoom
    if (zoom !== undefined) this.#setZoom(zoom)
    // set bearing & pitch
    this.setCompass(bearing, pitch)
  }

  setLonLat (lon: number, lat: number): void {
    this.#setLonLat(lon, lat)
  }

  setZoom (zoom: number): void {
    this.#setZoom(zoom)
  }

  setCompass (bearing?: number, pitch?: number): void {
    let update = false
    // set bearing & pitch
    if (bearing !== undefined) update ||= this.#setBearing(bearing)
    // set pitch
    if (pitch !== undefined) update ||= this.#setPitch(pitch)
    // if update we let the map know
    if (update) this.camera._updateCompass(this.bearing, this.pitch)
  }

  zoomChange (): number {
    const { zoom, prevZoom } = this
    const { floor } = Math
    return floor(zoom) - floor(prevZoom)
  }

  zoomScale (zoom: number = this.zoom): number {
    return Math.pow(2, zoom)
  }

  clampLat (input: number): number {
    const { maxLatPosition, minLatPosition, zoom } = this
    const { min, max } = Math
    // prep current boundaries
    const latPosDiff = maxLatPosition - minLatPosition
    const curMaxLat = min(minLatPosition + min(latPosDiff, (latPosDiff / 3) * zoom), maxLatPosition)
    // clamp
    return max(min(curMaxLat, input), -curMaxLat)
  }

  clampZoom (input: number): number {
    const { minzoom, maxzoom } = this
    return Math.max(Math.min(input, maxzoom), minzoom)
  }

  clampDeg (input: number): number {
    while (input >= 180) { input -= 360 }
    while (input < -180) { input += 360 }
    return input
  }

  resize (width: number, height: number): void {
    this.aspect[0] = width
    this.aspect[1] = height
    // cleanup
    this.reset()
  }

  // user scrolled
  onZoom (zoomInput: number, canvasX: number, canvasY: number): void {
    const { positionalZoom, multiplier, aspect } = this
    // set zoom
    this.#setZoom(this.zoom - (0.003 * zoomInput))
    if (this.prevZoom === this.zoom) return
    // if positionalZoom, we adjust the lon and lat according to the mouse position.
    // consider the distance between the lon-lat of our current "center" position and
    // the lon-lat of the cursor position PRE-zoom adjustment. After zooming, we
    // want to readjust our lon-lat position to compensate for that delta.
    if (positionalZoom) {
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
  onMove (
    movementX = 0,
    movementY = 0,
    multiplierX: number = 6.5 * 360,
    multiplierY: number = 6.5 * 180
  ): void {
    let { lon, lat, bearing } = this
    const { abs, max, min, cos, sin, PI } = Math
    const zScale = max(this.zoomScale(), 1)
    // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
    const lonMultiplier = min(30, 1 / cos(abs(this.lat) * PI / 180))
    // adjust movement vector if bearing
    if (bearing !== 0) {
      bearing = degToRad(bearing) // adjust to radians
      const tmpY = movementX * sin(bearing) + movementY * cos(bearing)
      movementX = movementX * cos(bearing) - movementY * sin(bearing)
      movementY = tmpY
    }
    // set the new lon-lat
    this.#setLonLat(
      lon - (movementX / (multiplierX * zScale) * 360 * lonMultiplier),
      lat + (movementY / (multiplierY * zScale) * 180)
    )
  }

  // x and y are the distances from the center of the screen
  cursorToLonLat (x: number, y: number): undefined | [number, number] {
    const { lon, lat, zoom, tileSize } = this
    return _cursorToLonLat(lon, lat, x, y, (tileSize * Math.pow(2, zoom)) / 2)
  }

  getMatrix (type: MatrixType): Float32Array {
    let matrix = this.matrices[type]
    if (matrix !== undefined) return mat4.clone(matrix)
    // updated matrix
    matrix = this.matrices[type] = this.#getMatrix(type)

    return mat4.clone(matrix)
  }

  getTilesInView (): bigint[] { // (S2CellIDs)
    const { radius, zoom, zoomOffset, lon, lat } = this
    const matrix = this.getMatrix('m')
    return getTiles(zoom + zoomOffset, matrix, lon, lat, radius)
  }

  getTilesAtPosition (lon: number, lat: number, zoom: number, bearing: number, pitch: number): bigint[] { // (S2CellIDs)
    const { radius, zoomOffset } = this
    const matrix = this.#getMatrix('m', false, lon, lat, zoom, bearing, pitch)
    return getTiles(zoom + zoomOffset, matrix, lon, lat, radius)
  }

  /* INTERNAL FUNCTIONS */

  #setLonLat (lon: number, lat: number): void {
    if (!this.noClamp) {
      lon = this.clampDeg(lon)
      lat = this.clampLat(lat)
    }
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

  #setZoom (zoom: number): void {
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

  #setBearing (bearing: number): boolean {
    bearing = this.clampDeg(bearing)
    if (this.bearing !== bearing) {
      this.bearing = bearing
      // cleanup for next render
      this.reset()
      return true
    }
    return false
  }

  #setPitch (pitch: number): boolean {
    if (this.pitch !== pitch) {
      this.pitch = pitch
      // cleanup for next render
      this.reset()
      return true
    }
    return false
  }

  #getMatrix (
    type: MatrixType,
    updateEye = true,
    lon: number = this.lon,
    lat: number = this.lat,
    zoom: number = this.zoom,
    bearing: number = this.bearing,
    pitch: number = this.pitch
  ): Float32Array {
    // update eye
    const eye = this.#updateEye(lon, lat, zoom, updateEye)
    // get projection matrix
    let matrix = this.#getProjectionMatrix(type, zoom)
    // create view matrix
    const view = mat4.lookAt(eye, [0, (lat > 90 || lat < -90) ? -1 : 1, 0])
    // adjust by bearing
    if (bearing !== 0) mat4.rotateZ(matrix, degToRad(bearing))
    // if km we "remove" the eye
    if (type === 'km') { view[12] = 0; view[13] = 0; view[14] = 0 }
    // multiply projection matrix by view matrix
    matrix = mat4.multiply(matrix, view)

    return matrix
  }

  #updateEye (lon: number, lat: number, zoom: number, update = true): [number, number, number] {
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

  #getProjectionMatrix (type: MatrixType, zoom: number = this.zoom): Float32Array {
    let { radius, aspect, tileSize, multiplier } = this
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

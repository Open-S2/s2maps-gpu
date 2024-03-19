import type Camera from '..'
import * as mat4 from './mat4'
import { getTilesS2, getTilesWM } from './getTiles'
import { cursorToLonLatS2, cursorToLonLatWM } from './cursorToLonLat'
import { EARTH_RADIUS, EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR, degToRad } from 'geometry'
import { fromLonLatGL, mul, normalize } from 'geometry/s2/s2Point'
import { mercatorLatScale, pxToLL } from 'geometry/wm'

import type { MapOptions } from 'ui/s2mapUI'
import type { Projection, StyleDefinition } from 'style/style.spec'
import type { Point, XYZ } from 'geometry'

export interface View {
  /** the longitude of the map */
  lon?: number
  /** the latitude of the map */
  lat?: number
  /** zoom level of the map */
  zoom?: number
  /** bearing/compass of the map camera */
  bearing?: number
  /** pitch/vertical-angle of the map camera */
  pitch?: number
}

export type MatrixType = 'm' | 'km' // meters or kilometers

export default class Projector {
  camera: Camera
  projection: Projection = 'S2'
  webworker = false
  noClamp = false
  // radius is the radius of the earth in kilometers
  radius = EARTH_RADIUS / 1_000
  // radii is the radius of the earth in meters for each axis
  radii: XYZ = [EARTH_RADIUS_EQUATORIAL, EARTH_RADIUS_POLAR, EARTH_RADIUS_EQUATORIAL]
  zTranslateStart = 5
  zTranslateEnd = 1.001
  zoomEnd = 5
  positionalZoom = true
  // [zoom, lon, lat, bearing, pitch, time, aspectX, aspectY, mouseX, mouseY, deltaMouseX, deltaMouseY, featureState, currFeature]
  view: Float32Array = new Float32Array(14)
  aspect: [number, number] = [400, 300] // default canvas width x height
  matrices: { [key in MatrixType]?: Float32Array } = {}
  eye: XYZ = [0, 0, 0] // [x, y, z] only z should change for visual effects
  constrainZoomToFill = true
  duplicateHorizontally = true
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
    const { canvasMultiplier, positionalZoom, noClamp, style } = config
    if (typeof style === 'object' && style.projection === 'WM') this.projection = 'WM'
    if (canvasMultiplier !== undefined) this.multiplier = canvasMultiplier
    if (positionalZoom === false) this.positionalZoom = false
    this.webworker = camera.webworker
    if (noClamp === true) this.noClamp = true
    this.camera = camera
    // setup deltaMouse positions to middle of 0 and 2^32
    this.view[10] = 2 ** 11
    this.view[11] = 2 ** 11
  }

  /* API */

  reset (): void {
    if (!this.dirty) {
      this.dirty = true
      this.matrices = {}
    }
  }

  /// Input is the pixel position (0->width, 0->height). Convert to -1->1 for the GPU
  setMousePosition (x: number, y: number): void {
    const [width, height] = this.aspect
    this.view[8] = (x / width) * 2 - 1
    this.view[9] = (y / height) * -2 + 1
  }

  setFeatureState (state: 0 | 1 | 2): void {
    this.view[12] = state
    this.dirty = true
  }

  setCurrentFeature (id: number): void {
    this.view[13] = id
    this.dirty = true
  }

  setStyleParameters (style: StyleDefinition, ignorePosition: boolean): void {
    const { min, max } = Math
    const {
      constrainZoomToFill, duplicateHorizontally,
      noClamp, minLatPosition, maxLatPosition, zoomOffset,
      zNear, zFar, view
    } = style
    const { lon, lat, zoom, bearing, pitch } = view ?? {}
    const maxzoom = style.maxzoom ?? this.maxzoom
    const minzoom = style.minzoom ?? this.minzoom
    // setup wm properties if needed
    if (constrainZoomToFill !== undefined) this.constrainZoomToFill = constrainZoomToFill
    if (duplicateHorizontally !== undefined) this.duplicateHorizontally = duplicateHorizontally
    if (!this.constrainZoomToFill && this.duplicateHorizontally) {
      console.warn('duplicateHorizontally may only be used if constrainZoomToFill is true. Setting duplicateHorizontally to false.')
      this.duplicateHorizontally = false
    }
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
    if (!ignorePosition) this.setView({ lon, lat, zoom, bearing, pitch })
  }

  setView ({ zoom, lon, lat, bearing, pitch }: View): void {
    this.#setView({
      zoom: zoom ?? this.zoom,
      lon: lon ?? this.lon,
      lat: lat ?? this.lat,
      bearing: bearing ?? this.bearing,
      pitch: pitch ?? this.pitch
    })
  }

  zoomChange (): number {
    const { zoom, prevZoom } = this
    const { floor } = Math
    return floor(zoom) - floor(prevZoom)
  }

  zoomScale (zoom: number = this.zoom): number {
    return Math.pow(2, zoom)
  }

  resize (width: number, height: number): void {
    this.view[6] = this.aspect[0] = width
    this.view[7] = this.aspect[1] = height
    // update view
    this.setView({})
    // cleanup
    this.reset()
  }

  // user scrolled
  onZoom (zoomInput: number, canvasX: number, canvasY: number): void {
    const { positionalZoom, multiplier, aspect } = this
    // set zoom
    this.setView({ zoom: this.zoom - (0.003 * zoomInput) })
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
      if (this.projection === 'S2') this.onMove(-posDeltaX, posDeltaY, 3072, 1536)
      else this.onMove(-posDeltaX, posDeltaY, 1, 1)
    }
  }

  // user mouse/touch input (or swipe animation)
  onMove (
    movementX = 0,
    movementY = 0,
    multiplierX?: number,
    multiplierY?: number
  ): void {
    this.#setMove(movementX, movementY)
    const { lon, lat, tileSize, projection } = this
    let { bearing } = this
    const { abs, max, min, PI, sin, cos } = Math
    const zScale = max(this.zoomScale(), 1)
    const tileScale = tileSize / 512
    const isS2 = projection === 'S2'
    // setup multipliers
    if (multiplierX === undefined) multiplierX = isS2 ? (13 * 360) : 1.5
    if (multiplierY === undefined) multiplierY = isS2 ? (13 * 180) : 1.5
    if (!isS2) {
      multiplierX *= tileScale
      multiplierY *= tileScale
    }
    // adjust movement vector if bearing
    if (bearing !== 0) {
      bearing = degToRad(bearing) // adjust to radians
      const tmpY = movementX * sin(bearing) + movementY * cos(bearing)
      movementX = movementX * cos(bearing) - movementY * sin(bearing)
      movementY = tmpY
    }

    // set the new lon-lat
    if (isS2) {
      // https://math.stackexchange.com/questions/377445/given-a-latitude-how-many-miles-is-the-corresponding-longitude
      const lonMultiplier = min(30, 1 / cos(abs(lat) * PI / 180))
      this.setView({
        lon: lon - (movementX / (multiplierX * zScale) * 360 * lonMultiplier),
        lat: lat + (movementY / (multiplierY * zScale) * 180)
      })
    } else {
      this.setView({
        lon: lon - (movementX / (multiplierX * zScale)),
        lat: lat + (movementY / (multiplierY * zScale * mercatorLatScale(lat)))
      })
    }
  }

  // x and y are the distances from the center of the screen
  cursorToLonLat (xOffset: number, yOffset: number): undefined | [lon: number, lat: number] {
    const { projection, lon, lat, zoom, tileSize, multiplier } = this
    if (projection === 'S2') return cursorToLonLatS2(lon, lat, xOffset, yOffset, (tileSize * Math.pow(2, zoom)) / 2)
    return cursorToLonLatWM(lon, lat, xOffset, yOffset, zoom, tileSize / multiplier)
  }

  // S2 -> type of meters or kilometers
  // WM -> scale and offset
  getMatrix (typeOrScale: number | MatrixType, offset: Point = [0, 0]): Float32Array {
    if (typeof typeOrScale === 'number') { // WM case
      const matrix = this.#getMatrixWM(typeOrScale, offset)
      return mat4.clone(matrix)
    }
    // S2
    let matrix = this.matrices[typeOrScale]
    if (matrix !== undefined) return mat4.clone(matrix)
    // updated matrix
    matrix = this.matrices[typeOrScale] = this.#getMatrixS2(typeOrScale)

    return mat4.clone(matrix)
  }

  getTilesInView (): bigint[] { // (Tile IDs)
    const { projection, radius, zoom, zoomOffset, lon, lat } = this
    if (projection === 'S2') {
      const matrix = this.getMatrix('m')
      return getTilesS2(zoom + zoomOffset, lon, lat, matrix, radius)
    }
    return getTilesWM(zoom + zoomOffset, lon, lat, this)
  }

  getTilesAtPosition (lon: number, lat: number, zoom: number, bearing: number, pitch: number): bigint[] { // (S2CellIDs)
    const { projection, radius, zoomOffset } = this
    if (projection === 'S2') {
      const matrix = this.#getMatrixS2('m', false, lon, lat, zoom, bearing, pitch)
      return getTilesS2(zoom + zoomOffset, lon, lat, matrix, radius)
    }
    // TODO: bearing and pitch without editing the projection?
    return getTilesWM(zoom + zoomOffset, lon, lat, this)
  }

  /* INTERNAL FUNCTIONS */

  #setMove (movementX: number, movementY: number): void {
    const { view, aspect } = this
    const maxValue = 2 ** 11
    const midValue = 2 ** 10
    view[10] -= movementX / aspect[0]
    view[11] += movementY / aspect[1]
    // if we ever hit the min-max values, we reset to the middle
    if (view[10] < 0 || view[10] > maxValue) view[10] = midValue
    if (view[11] < 0 || view[11] > maxValue) view[11] = midValue
  }

  #setView (view: Required<View>): void {
    // clamp the view based upon the current settings
    this.#clampView(view)
    // update if any changes found:
    const { zoom, lon, lat, bearing, pitch } = view
    const bearingPitchChange = this.bearing !== bearing || this.pitch !== pitch
    if (
      // zoom change?
      this.zoom !== zoom || this.prevZoom !== zoom ||
      // lon-lat change?
      this.lon !== lon || this.lat !== lat ||
      // bearing or pitch change?
      bearingPitchChange
    ) {
      // keep track of the old zoom and adjust the zoom
      this.prevZoom = this.zoom
      this.zoom = zoom
      // adjust the lon-lat
      this.lon = lon
      this.lat = lat
      // adjust the bearing and pitch
      this.bearing = bearing
      this.pitch = pitch
      // update view
      this.view[0] = this.zoom
      this.view[1] = this.lon
      this.view[2] = this.lat
      this.view[3] = this.bearing
      this.view[4] = this.pitch
      // if bearing or pitch change we let the map know
      if (bearingPitchChange) this.camera._updateCompass(this.bearing, this.pitch)
      // cleanup for next render
      this.reset()
    }
  }

  #clampView (view: Required<View>): void {
    const { noClamp, constrainZoomToFill, projection } = this
    // adjust zoom
    this.#clampZoom(view)
    // adjust lon-lat
    if (!noClamp) {
      view.lon = this.#clampDeg(view.lon)
      this.#clampLat(view)
    }
    // adjust bearing
    view.bearing = this.#clampDeg(view.bearing)
    // adjust view if constrained to fill
    if (projection === 'WM' && constrainZoomToFill) this.#clampConstraint(view)
  }

  #clampZoom (view: Required<View>): void {
    const { minzoom, maxzoom } = this
    view.zoom = Math.max(Math.min(view.zoom, maxzoom), minzoom)
  }

  #clampLat (view: Required<View>): void {
    const { maxLatPosition, minLatPosition, zoom } = this
    const { min, max } = Math
    // prep current boundaries
    const latPosDiff = maxLatPosition - minLatPosition
    const curMaxLat = min(minLatPosition + min(latPosDiff, (latPosDiff / 3) * zoom), maxLatPosition)
    // clamp
    view.lat = max(min(curMaxLat, view.lat), -curMaxLat)
  }

  #clampConstraint (view: Required<View>): void {
    const { aspect, tileSize } = this
    // if tileSize relative to zoom is smaller than aspect, we adjust zoom
    if (tileSize * Math.pow(2, view.zoom) < aspect[1]) view.zoom = Math.log2(aspect[1] / tileSize)
    // now that we have the min zoom, we can adjust the latitude to ensure the view is within bounds
    const worldSize = tileSize * Math.pow(2, view.zoom)
    const center = worldSize / 2
    const worldMinusAspectHalfed = (worldSize - aspect[1]) / 2
    const [,maxLat] = pxToLL([0, center - worldMinusAspectHalfed], view.zoom, tileSize)
    const [,minLat] = pxToLL([0, center + worldMinusAspectHalfed], view.zoom, tileSize)
    view.lat = Math.min(maxLat, Math.max(minLat, view.lat))
  }

  #clampDeg (input: number): number {
    while (input >= 180) { input -= 360 }
    while (input < -180) { input += 360 }
    return input
  }

  // * S2

  #getMatrixS2 (
    type: MatrixType,
    updateEye = true,
    lon: number = this.lon,
    lat: number = this.lat,
    zoom: number = this.zoom,
    bearing: number = this.bearing,
    pitch: number = this.pitch
  ): Float32Array {
    // update eye
    const eye = this.#updateEyeS2(lon, lat, zoom, updateEye)
    // get projection matrix
    let matrix = this.#getProjectionMatrixS2(type, zoom)
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

  #updateEyeS2 (lon: number, lat: number, zoom: number, update = true): [number, number, number] {
    const { radius, zTranslateEnd, zTranslateStart, zoomEnd } = this
    // find radial distance from core of ellipsoid
    const radialMultiplier = Math.max(
      (zTranslateEnd - zTranslateStart) / zoomEnd * zoom + zTranslateStart,
      zTranslateEnd
    ) * radius
    // create xyz point for eye
    const eye = mul(normalize(fromLonLatGL(lon, lat)), radialMultiplier)
    if (update) this.eye = eye

    return eye
  }

  #getProjectionMatrixS2 (type: MatrixType, zoom: number = this.zoom): Float32Array {
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

  // * WM

  #getMatrixWM (
    scale: number,
    offset: Point,
    bearing: number = this.bearing,
    pitch: number = this.pitch
  ): Float32Array {
    const [offsetX, offsetY] = offset
    // get projection matrix
    let matrix = this.#getProjectionMatrixWM(scale)
    // create view matrix
    const view = mat4.lookAt([0, 0, -1], [0, -1, 0])
    // adjust by bearing
    if (bearing !== 0) mat4.rotateZ(matrix, degToRad(bearing))
    // multiply projection matrix by view matrix
    matrix = mat4.multiply(matrix, view)

    // adjust by position
    mat4.translate(matrix, [-offsetX, -offsetY, 0])

    return matrix
  }

  #getProjectionMatrixWM (scale: number): Float32Array {
    const { aspect, tileSize, multiplier } = this
    // prep a matrix
    const matrix = mat4.create()
    // adjust aspect ratio by zoom
    const multpl = 1 / multiplier / (tileSize * scale)
    // create projection
    mat4.ortho(matrix, aspect[0] * multpl, aspect[1] * multpl, 1_000)

    return matrix
  }
}

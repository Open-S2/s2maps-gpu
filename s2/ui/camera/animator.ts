import { Orthodrome } from 's2projection/s2LonLat'

import type Projector from './projector'

export type Easing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out'

export interface AnimationDirections {
  lon?: number
  lat?: number
  zoom?: number
  bearing?: number
  pitch?: number
  speed?: number
  duration?: number
  easing?: Easing
}

export type AnimationType = 'easeTo' | 'flyTo'

export type IncrementResponse = [boolean, [number, number, number, number, number]]

export default class Animator {
  startTime?: number
  startLon: number
  startLat: number
  startZoom: number
  startBearing: number
  startPitch: number
  endLon: number
  endLat: number
  endZoom: number
  endBearing: number
  endPitch: number
  deltaLon: number
  deltaLat: number
  deltaZoom: number
  deltaBearing: number
  deltaPitch: number
  speed = 0
  duration = 2.5
  velocity = 0
  futureOffset = 0
  futureTiles: Map<number, bigint[]> = new Map() // timeKey: [tileID]
  futureKeys: number[] = []
  ease: (time: number, start: number, delta: number, duration: number) => number
  #increment?: (time: number) => IncrementResponse
  projector: Projector
  constructor (projector: Projector, directions: AnimationDirections = {}) {
    this.projector = projector
    // setup animation paramaters
    if (directions.easing === 'ease-in') this.ease = easeInExpo
    else if (directions.easing === 'ease-out') this.ease = easeOutExpo
    else if (directions.easing === 'ease-in-out') this.ease = easeInOutExpo
    else this.ease = easeLinear
    if (directions.duration !== undefined) this.duration = directions.duration
    if (directions.speed !== undefined) this.speed = directions.speed
    // pull in varaibles
    const lon = directions.lon ?? projector.lon
    const lat = directions.lat ?? projector.lat
    const zoom = projector.clampZoom(directions.zoom ?? projector.zoom)
    const bearing = directions.bearing ?? projector.bearing
    const pitch = directions.pitch ?? projector.pitch
    // setup variables
    this.startLon = projector.lon
    this.startLat = projector.lat
    this.startZoom = projector.zoom
    this.startBearing = projector.bearing
    this.startPitch = projector.pitch
    this.endLon = lon
    this.endLat = lat
    this.endZoom = zoom
    this.endBearing = bearing
    this.endPitch = pitch
    this.deltaLon = lon - projector.lon
    this.deltaLat = lat - projector.lat
    this.deltaZoom = zoom - projector.zoom
    this.deltaBearing = bearing - projector.bearing
    this.deltaPitch = pitch - projector.pitch
  }

  // Updates the position based upon time. returns whether complete or not.
  increment (time: number): boolean {
    const { projector, futureOffset, futureKeys, duration } = this
    // corner case: increment was never setup
    if (this.#increment === undefined) return true
    // setup time should it not exist yet
    if (this.startTime === undefined) this.startTime = time
    // if current time is greater than or equal to the latest futureKeys, send off a request to preload tiles
    if (futureKeys[0] - futureOffset <= time) this._requestFutureTiles()
    // build the new lon, lat, zoom, bearing, pitch
    const [finished, pos] = this.#increment(time - this.startTime)
    // grab the positions
    const [lon, lat, zoom, bearing, pitch] = pos
    // update the projector
    projector.setPosition(lon, lat, zoom, bearing, pitch)
    // return if time has passed or we are finished
    if (finished || time - this.startTime >= duration) return true
    return false
  }

  zoomTo (): void {
    const { startLon, startLat, startZoom, deltaLon, deltaLat, deltaZoom, endLon, endLat, endZoom, endBearing, endPitch, duration } = this
    this.#increment = (time: number): IncrementResponse => {
      if (time >= duration) return [true, [endLon, endLat, endZoom, endBearing, endPitch]]
      return [
        false,
        [
          easeOutExpo(time, startLon, deltaLon, duration),
          easeOutExpo(time, startLat, deltaLat, duration),
          easeOutExpo(time, startZoom, deltaZoom, duration),
          endBearing,
          endPitch
        ]
      ]
    }
    // build renderTile list
    this._buildFutureTileList()
  }

  compassTo (): void {
    const { startBearing, startPitch, deltaBearing, deltaPitch, endLon, endLat, endZoom, endBearing, endPitch, duration } = this
    this.#increment = (time: number): IncrementResponse => {
      if (time >= duration) return [true, [endLon, endLat, endZoom, endBearing, endPitch]]
      return [
        false,
        [
          endLon,
          endLat,
          endZoom,
          easeOutExpo(time, startBearing, deltaBearing, duration),
          easeOutExpo(time, startPitch, deltaPitch, duration)
        ]
      ]
    }
    // build renderTile list
    this._buildFutureTileList()
  }

  swipeTo (movementX: number, movementY: number): void {
    const { projector, duration } = this
    const { abs } = Math
    this.#increment = (time: number): IncrementResponse => {
      const newMovementX = easeInExpo(duration - time, 0, movementX, duration)
      const newMovementY = easeInExpo(duration - time, 0, movementY, duration)
      if (abs(newMovementX) <= 0.5 && abs(newMovementY) <= 0.5) return [true, [projector.lon, projector.lat, projector.zoom, projector.bearing, projector.pitch]]
      projector.onMove(newMovementX, newMovementY)
      return [false, [projector.lon, projector.lat, projector.zoom, projector.bearing, projector.pitch]]
    }
  }

  easeTo (): boolean {
    const {
      startLon, startLat, startZoom, startBearing, startPitch,
      deltaZoom, deltaBearing, deltaPitch,
      endLon, endLat, endZoom, endBearing, endPitch,
      duration, ease
    } = this
    if (startLat === endLat && startLon === endLon && startZoom === endZoom && startBearing === endBearing && startPitch === endPitch) return false
    // setup orthodrome for lon and lat
    const orthodrome = new Orthodrome(startLon, startLat, endLon, endLat)
    // zooming out should have an easeOut while zooming in should have an easeIn
    const zoomEase = ease ?? ((deltaZoom > 0) ? easeInExpo : easeOutExpo)
    // meanwhile lon, lat should have an easeOut while zooming in and easeIn while zooming out
    const lonLatEase = ease ?? ((deltaZoom > 0) ? easeOutExpo : easeInExpo)
    // bearing and pitch benefits the most from ease-in-out
    const bearingPitchEase = ease ?? easeInOutExpo
    // given a time input in seconds, update the cameras positions
    this.#increment = (time: number): IncrementResponse => {
      if (time >= duration) return [true, [endLon, endLat, endZoom, endBearing, endPitch]]
      return [
        false,
        [
          ...orthodrome.intermediatePoint(lonLatEase(time, 0, 1, duration)),
          zoomEase(time, startZoom, deltaZoom, duration),
          bearingPitchEase(time, startBearing, deltaBearing, duration),
          bearingPitchEase(time, startPitch, deltaPitch, duration)
        ]
      ]
    }
    // build renderTile list
    this._buildFutureTileList()
    return true
  }

  flyTo (): boolean {
    // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
    // ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
    const {
      startLon, startLat, startZoom, startBearing, startPitch,
      deltaBearing, deltaPitch,
      endLon, endLat, endZoom, endBearing, endPitch,
      projector, duration, ease
    } = this
    if (startLat === endLat && startLon === endLon && startZoom === endZoom && startBearing === endBearing && startPitch === endPitch) return false
    const { max, sqrt, log, exp, abs, LN2 } = Math
    // setup variables
    const orthodrome = new Orthodrome(startLon, startLat, endLon, endLat)
    const rho = 1.42 // curve
    const scale = projector.zoomScale(endZoom - startZoom)
    // bearing and pitch benefits the most from ease-in-out
    const bearingPitchEase = ease ?? easeInOutExpo

    // w₀: Initial visible span, measured in pixels at the initial scale.
    const [width, height] = projector.aspect
    const w0 = max(width, height)
    // w₁: Final visible span, measured in pixels with respect to the initial scale.
    const w1 = w0 / scale
    // Length of the flight path as projected onto the ground plane, measured in pixels from
    // the world image origin at the initial scale.
    // degToRad(45) * projector.radius * 1000
    // 360deg = 2_048 (512 * 4) pixels at 0 zoom = 40_030_228.88407185 (2 * Math.PI * 6_371_008.8) (circumference) meters
    // so 40_030_228.88407185 / 2_048 = 19_546.010197300708meters/pixel
    const distanceMeters = projector.radius * 1_000 * orthodrome.distanceTo()
    const u1 = (distanceMeters / 19_546.010197300708) * projector.zoomScale(startZoom)
    // ρ²
    const rho2 = rho * rho
    // rᵢ: Returns the zoom-out factor at one end of the animation.
    // i 0 for the ascent or 1 for the descent.
    const r = (i: number): number => {
      const b = (w1 * w1 - w0 * w0 + (i !== 0 ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i !== 0 ? w1 : w0) * rho2 * u1)
      return log(sqrt(b * b + 1) - b)
    }
    // setup trig
    const sinh = (n: number): number => { return (exp(n) - exp(-n)) / 2 }
    const cosh = (n: number): number => { return (exp(n) + exp(-n)) / 2 }
    const tanh = (n: number): number => { return sinh(n) / cosh(n) }
    // r₀: Zoom-out factor during ascent.
    const r0 = r(0)
    // w(s): Returns the visible span on the ground, measured in pixels with respect to the
    // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
    let w = (s: number): number => { return cosh(r0) / cosh(r0 + rho * s) }
    // u(s): Returns the distance along the flight path as projected onto the ground plane,
    // measured in pixels from the world image origin at the initial scale.
    let u = (s: number): number => { return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1 }
    // S: Total length of the flight path, measured in ρ-screenfuls.
    let S = (r(1) - r0) / rho
    // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
    if (abs(u1) < 0.000001 || !isFinite(S)) {
      // Perform a more or less instantaneous transition if the path is too short.
      if (abs(w0 - w1) < 0.000001) return this.easeTo()
      // otherwise adjust S, u & w
      const k = w1 < w0 ? -1 : 1
      S = abs(log(w1 / w0)) / rho
      u = (_: number): number => { return 0 }
      w = (s: number): number => { return exp(k * rho * s) }
    }
    // adjust duration if speed is provided
    if (this.speed !== 0) this.duration = S / this.speed

    // setup animation function
    this.#increment = (time: number): IncrementResponse => {
      if (time >= duration) return [true, [endLon, endLat, endZoom, endBearing, endPitch]]
      const s = (time / duration) * S
      const uS = u(s)
      const curScale = 1 / w(s)

      return [
        false,
        [
          ...orthodrome.intermediatePoint(uS),
          startZoom + (log(curScale) / LN2),
          bearingPitchEase(time, startBearing, deltaBearing, duration),
          bearingPitchEase(time, startPitch, deltaPitch, duration)
        ]
      ]
    }

    // build renderTile list
    this._buildFutureTileList()
    return true
  }

  _buildFutureTileList (): void {
    if (this.#increment === undefined) return
    const { endLon, endLat, endZoom, endBearing, endPitch, projector, duration } = this
    const tileSet = new Set(projector.camera.getTiles().map(tile => tile.id))
    const newTiles = new Map()
    let tilesFound: boolean
    const batch: Array<[number, number, number, bigint[]]> = [
      [0, duration, duration, projector.getTilesAtPosition(endLon, endLat, endZoom, endBearing, endPitch)],
      [0, duration, duration / 2, projector.getTilesAtPosition(...this.#increment(duration / 2)[1])]
    ]
    // keep diving / spliting while tested tiles are not equal to
    while (batch.length !== 0) {
      // reset checker
      tilesFound = false
      // pull in a batch check
      const tileList = batch.shift()
      if (tileList === undefined) continue
      const [low, high, pos, tiles] = tileList
      // store any new tiles and track if any of them new
      for (const tile of tiles) {
        if (!tileSet.has(tile)) {
          tileSet.add(tile)
          if (!newTiles.has(pos)) newTiles.set(pos, [tile])
          tilesFound = true
        }
      }
      // if "tilesFound" than test midpoint positions
      if (tilesFound && pos !== duration) {
        const lowPosHalf = (low + pos) / 2
        const posHighHalf = (pos + high) / 2
        batch.push(
          [low, pos, lowPosHalf, projector.getTilesAtPosition(...this.#increment(lowPosHalf)[1])],
          [pos, high, posHighHalf, projector.getTilesAtPosition(...this.#increment(posHighHalf)[1])]
        )
      }
    }
    // store tiles
    this.futureTiles = newTiles
    // store keys
    this.futureKeys = []
    for (const key of Object.keys(newTiles)) this.futureKeys.push(+key)
    this.futureKeys = this.futureKeys.sort((a, b) => a - b)
    this.futureOffset = this.futureKeys[0]
    // pre-request the first three tile sets
    this._requestFutureTiles()
    this._requestFutureTiles()
    this._requestFutureTiles()
  }

  _requestFutureTiles (): void {
    if (this.futureKeys.length === 0) return
    const { futureKeys, futureTiles, projector } = this
    const { camera } = projector
    // get a key
    const key = futureKeys.shift()
    if (key === undefined) return
    // pull in the tiles
    const tiles = futureTiles.get(key)
    if (tiles === undefined) return
    // make a request
    camera.createFutureTiles(tiles)
    // cleanup now uneaded tile reference
    futureTiles.delete(key)
  }
}

// https://spicyyoghurt.com/tools/easing-functions

function easeLinear (time: number, start: number, delta: number, duration: number): number {
  return delta * time / duration + start
}

function easeInExpo (time: number, start: number, delta: number, duration: number): number {
  return (time === 0) ? start : delta * Math.pow(2, 10 * (time / duration - 1)) + start
}

// function easeInQuad (time: number, start: number, delta: number, duration: number): number {
//   return delta * (time /= duration) * time + start
// }

// function easeOutCubic (time: number, start: number, delta: number, duration: number): number {
//   return delta * ((time = time / duration - 1) * time * time + 1) + start
// }

function easeOutExpo (time: number, start: number, delta: number, duration: number): number {
  return delta * (-Math.pow(2, -10 * time / duration) + 1) + start
}

// function easeOutQuad (time: number, start: number, delta: number, duration: number): number {
//   return -delta * (time /= duration) * (time - 2) + start
// }

// function easeInCubic (t, b, c, d) {
//     return c * (t /= d) * t * t + b;
// }

function easeInOutExpo (time: number, start: number, delta: number, duration: number): number {
  if (time === 0) return start
  if ((time /= duration / 2) < 1) return delta / 2 * Math.pow(2, 10 * (time - 1)) + start
  return delta / 2 * (-Math.pow(2, -10 * --time) + 2) + start
}

// function easeInOutQuad (time: number, start: number, delta: number, duration: number): number {
//   if ((time /= duration / 2) < 1) return delta / 2 * time * time + start
//   return -delta / 2 * ((--time) * (time - 2) - 1) + start
// }

// function easeInOutCubic (t, b, c, d) {
//     if ((t /= d / 2) < 1) return c / 2 * t * t * t + b;
//     return c / 2 * ((t -= 2) * t * t + 2) + b;
// }

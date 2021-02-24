// @flow
import * as mat4 from '../../../util/mat4'
import { default as getTiles } from './getTilesInView'
import { degToRad } from 's2projection'

import type { Projection } from './projection'

export type ProjectionConfig = {
  translation?: [number, number, number],
  maxLatRotation?: number,
  zoom?: number,
  minzoom?: number,
  maxzoom?: number,
  lon?: number,
  lat?: number,
  scale?: number,
  zNear?: number,
  zFar?: number,
  width?: number,
  height?: number,
  canvasMultiplier: number
}

export type TileDefinition = [number, number, number, number, number]
export type TileDefinitions = Array<TileDefinition>

export default class Projector implements Projection {
  view: Float32Array = new Float32Array(16) // [zoom, lon, lat, angle, pitch, time, featureState, currFeature, ...extensions]
  translation: [number, number, number] = [0, 0, -10] // [x, y, z] only z should change for visual effects
  maxLatRotation: number = 85 // deg
  prevZoom: number = 0
  zoom: number = 0
  minzoom: number = 0
  maxzoom: number = 20
  lon: number = 0
  lat: number = 0
  pitch: number = 0
  scale: number = 1
  zNear: number = 500 // static; just for draw calls
  zFar: number = 100000 // static; just for draw calls
  aspect: Float32Array = new Float32Array([400, 300]) // default canvas width x height
  multiplier: number = 1
  sizeMatrices: { [number | string]: Float32Array } = {} // key is tileSize
  dirty: boolean = true
  constructor (config: ProjectionConfig) {
    if (config.translation) this.translation = config.translation
    if (config.maxLatRotation) this.maxLatRotation = config.maxLatRotation
    if (config.zoom) this.prevZoom = this.zoom = config.zoom
    if (config.lon) this.lon = config.lon
    if (config.lat) this.lat = config.lat
    if (config.scale) this.scale = config.scale
    if (config.zNear) this.zNear = config.zNear
    if (config.zFar) this.zFar = config.zFar
    if (config.width) this.aspect[0] = config.width
    if (config.height) this.aspect[1] = config.height
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
    else this.dirty = true // ensure this projector is dirty (incase of ignorePosition === true)
  }

  setPosition (lon: number, lat: number, zoom: number) {
    // set lon lat
    this.setLonLat(-lon, lat)
    // set zoom
    this.setZoom(zoom)
  }

  zoomChange (): number {
    return Math.floor(this.zoom) - Math.floor(this.prevZoom)
  }

  resize (width: number, height: number) {
    this.aspect[0] = width
    this.aspect[1] = height
    this.sizeMatrices = {}
    this.dirty = true
  }

  setZoom (zoom: number) {
    if (this.zoom !== zoom) {
      this.zoom = zoom
      this.view[0] = this.zoom
      this.onZoom()
      this.dirty = true
    }
  }

  onMove (movementX?: number = 0, movementY?: number = 0, multiplierX?: number = 3, multiplierY?: number = 3) {
    const { lat, zoom, maxLatRotation } = this
    const zoomMultiplier = 2 * Math.pow(2, Math.max(zoom, 0))
    const latMultiplier = 1.25 / maxLatRotation * Math.abs(lat) + 1 // if we are near the poles, we don't want to *feel* slowed down
    if (movementX) this.lon += movementX / (multiplierX * zoomMultiplier) * latMultiplier
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
    this.sizeMatrices = {}
    this.dirty = true
  }

  setLonLat (lon: number, lat: number) {
    if (this.lon !== lon && this.lat !== lat) {
      this.lon = lon
      this.lat = lat
      this.onMove()
      this.dirty = true
    }
  }

  getMatrix (size: number): Float32Array {
    const projection = this.getMatrixAtSize(size)
    // create view
    // const view = mat4.lookAt(this.translation, [0, 1, 1])
    // mat4.rotate(projection, [0, -0.001, 0])
    // translate
    mat4.translate(projection, this.translation)
    // console.log('projection', projection)
    // console.log('zoom', this.zoom)
    // console.log('aspect', this.aspect)
    // rotate position
    mat4.rotate(projection, [degToRad(this.lat), degToRad(this.lon), 0])
    // multiply projection by view
    // mat4.multiply(projection, view)
    // console.log('projection', projection)

    return projection
  }

  getTilesInView (size?: number = 512): TileDefinitions { // [face, zoom, x, y, hash]
    const matrix = this.getMatrix(size)
    return getTiles(this.zoom, matrix, this.lon, this.lat, this.radius)
  }
}

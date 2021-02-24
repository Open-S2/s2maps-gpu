// @flow
const mat4 = require('./mat4').default
// import { default as getTiles } from './getTilesInView'
const { degToRad } = require('s2projection')

class Projector {
  constructor () {
    this.view = new Float32Array(16)
    this.translation = [0, 0, -10] // [x, y, z] only z should change for visual effects
    this.maxLatRotation = 85 // deg
    this.prevZoom = 0
    this.zoom = 0
    this.minzoom = 0
    this.maxzoom = 20
    this.lon = 0
    this.lat = 0
    this.pitch = 0
    this.scale = 1
    // this.zNear = 0.5 // static; just for draw calls
    // this.zFar = 100 // static; just for draw calls
    this.zNear = 500 // static; just for draw calls
    this.zFar = 100_000 // static; just for draw calls
    this.aspect = new Float32Array([3360, 1346]) // default canvas width x height
    this.multiplier = 2
    this.sizeMatrices = {} // key is tileSize
    this.dirty = true
  }

  setFeatureState (state) {
    this.view[6] = state
  }

  setCurrentFeature (id) {
    this.view[7] = id
  }

  setStyleParameters (style, ignorePosition) {
    const { minzoom, maxzoom, zoom, lon, lat } = style
    // clamp values and ensure minzoom is less than maxzoom
    this.minzoom = (minzoom < -10) ? -10 : (minzoom > maxzoom) ? maxzoom - 1 : (minzoom > 29) ? 29 : minzoom
    this.maxzoom = (maxzoom > 30) ? 30 : (maxzoom < this.minzoom) ? this.minzoom + 1 : maxzoom
    // set position
    if (!ignorePosition) this.setPosition(lon, lat, zoom)
    else this.dirty = true // ensure this projector is dirty (incase of ignorePosition === true)
  }

  setPosition (lon, lat, zoom) {
    // set lon lat
    this.setLonLat(-lon, lat)
    // set zoom
    this.setZoom(zoom)
  }

  zoomChange () {
    return Math.floor(this.zoom) - Math.floor(this.prevZoom)
  }

  resize (width, height) {
    this.aspect[0] = width
    this.aspect[1] = height
    this.sizeMatrices = {}
    this.dirty = true
  }

  setZoom (zoom) {
    if (this.zoom !== zoom) {
      this.zoom = zoom
      this.view[0] = this.zoom
      this.onZoom()
      this.dirty = true
    }
  }

  onMove (movementX = 0, movementY = 0, multiplierX = 3, multiplierY = 3) {
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

  setLonLat (lon, lat) {
    if (this.lon !== lon && this.lat !== lat) {
      this.lon = lon
      this.lat = lat
      this.onMove()
      this.dirty = true
    }
  }

  getMatrix (size) {
    const projection = this.getMatrixAtSize(size)
    // create view
    // const view = mat4.lookAt(this.translation, [0, 1, 1])
    // mat4.rotate(projection, [0, -0.001, 0])
    // translate
    mat4.translate(projection, this.translation)
    console.log('projection', projection)
    console.log('zoom', this.zoom)
    // rotate position
    mat4.rotate(projection, [degToRad(this.lat), degToRad(this.lon), 0])
    // multiply projection by view
    // mat4.multiply(projection, view)
    // console.log('projection', projection)

    return projection
  }

  // getTilesInView (size?: number = 512): TileDefinitions { // [face, zoom, x, y, hash]
  //   const matrix = this.getMatrix(size)
  //   return getTiles(this.zoom, matrix, this.lon, this.lat)
  // }
}

exports.default = Projector

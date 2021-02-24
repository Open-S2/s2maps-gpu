// @flow
const mat4 = require('./mat4').default
const Projector = require('./projector').default

class BlendProjection extends Projector {
  constructor (config = {}) {
    super(config)
    this.zTranslateStart = -10
    this.zTranslateEnd = -3
    this.zoomStart = 2
    this.zoomEnd = 4

    this.onZoom(this.zoom)
  }

  onZoom (zoomInput = 0, canvasX = 0, canvasY = 0) {
    this.prevZoom = this.zoom
    this.zoom -= 0.003 * zoomInput
    const { prevZoom, minzoom, maxzoom, zoomStart, zoomEnd, zTranslateStart, zTranslateEnd } = this
    if (this.zoom > maxzoom) {
      this.zoom = maxzoom // if it overzooms but the previous zoom was not at maxzoom, we need to render one more time
      if (prevZoom === maxzoom) return false
    } else if (this.zoom < minzoom) {
      this.zoom = minzoom // if it underzooms but the previous zoom was not at minzoom, we need to render one more time
      if (prevZoom === minzoom) return false
    }
    const { zoom } = this
    const radius = 1000
    // update view
    this.view[0] = zoom
    // update scale
    this.scale = Math.pow(2, zoom) / radius
    // update transation
    this.translation[2] = (zoom < zoomStart) ? zTranslateStart * radius : Math.min(
      (((zTranslateEnd - zTranslateStart) / (zoomEnd - zoomStart)) * zoom) + zTranslateStart,
      zTranslateEnd
    ) * radius
    // cleanup
    this.sizeMatrices = {}
    this.dirty = true
    return true
  }

  getMatrixAtSize (tileSize = 512) {
    const { aspect, scale, multiplier, sizeMatrices, zNear, zFar, translation } = this

    if (sizeMatrices[tileSize]) return mat4.clone(sizeMatrices[tileSize])
    const matrix = mat4.create()
    // get height and width ratios for each tile
    const widthRatio = aspect[0] / multiplier / (tileSize * scale) / -translation[2]
    const heightRatio = aspect[1] / multiplier / (tileSize * scale) / -translation[2]
    // create projection
    mat4.blend(matrix, widthRatio, heightRatio, zNear, zFar)
    // updated matrix
    sizeMatrices[tileSize] = matrix

    return mat4.clone(matrix)
  }
}

exports.default = BlendProjection

// @flow
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { BBOX, Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { StyleLayers } from '../style'

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer/featureIndexBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the attributes object is for dataConditions and dataRanges.
export type FeatureGuide = {
  parentChild?: boolean,
  child?: boolean, // eslint-disable-next-line
  tile?: Tile,
  layerID: number,
  source: string,
  count: number,
  offset: number,
  type: string,
  featureCode: Float32Array
}

export type VectorTileSource = {
  type: 'vector',
  vertexArray: Float32Array,
  indexArray: Uint32Array,
  featureIndexArray: Uint8Array,
  vertexBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  featureIndexBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject,
  drawMode?: GLenum // gl.TRIANGLE_FAN, gl.TRIANGLE_STRIP, etc.
}

// SourceData will either be the current tiles VectorTileSource, RasterTileSource,
// or reference tile(s) to be masked + created.
// eslint-disable-next-line
export type SourceData = { [string | number]: VectorTileSource | Array<Tile> }

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously place spherical background
// data to ensure we get no awkward visuals.
// TODO: Every tile needs access to the painters context for creating and deleting the WebGLBuffer and WebGLVertexArrayObject
export default class Tile {
  id: number
  face: Face
  zoom: number
  x: number
  y: number
  size: number
  scale: number
  bbox: [number, number, number, number]
  extent: number = 4096
  division: number
  sourceData: SourceData = {}
  featureGuide: Array<FeatureGuide> = []
  context: WebGL2Context | WebGLContext
  fbo: WebGLFramebuffer
  texture: WebGLTexture
  constructor (context: WebGL2Context | WebGLContext, face: number, zoom: number,
    x: number, y: number, hash: number, size?: number = 512, scale?: number = 1) {
    this.context = context
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.size = size
    this.scale = scale
    this.bbox = bboxST(x, y, zoom)
    this._createDivision()
    this._buildBackgroundGeometry()
    this._buildMaskGeometry()
    this.buildFBO()
  }

  destroy () {
    const { gl } = this.context
    for (const sourceName in this.sourceData) {
      const source = this.sourceData[sourceName]
      if (source.type === 'vector') {
        if (source.vertexBuffer) gl.deleteBuffer(source.vertexBuffer)
        if (source.featureIndexBuffer) gl.deleteBuffer(source.featureIndexBuffer)
        if (source.indexBuffer) gl.deleteBuffer(source.indexBuffer)
        if (source.vao) this.context.deleteVertexArray(source.vao)
      }
    }
    if (this.texture) gl.deleteTexture(this.texture)
    if (this.fbo) gl.deleteFramebuffer(this.fbo)
  }

  // this is designed to maintain references to nearby tiles in zoom. This is to avoid awkard
  // flicker while the current tile loads.
  injectParentChildTiles (tileSet: null | Array<Tile>) {
    if (!tileSet) return
    // inject references to featureGuide from tiles in tileSet that have overlapping boundaries.
    // If somehow we reference a tile that also references a parentChild: skip (this shouldn't happen).
    for (const tile of tileSet) {
      const child = tile.zoom < this.zoom
      if (tile.zoom !== this.zoom && bboxOverlap(this.bbox, tile.bbox, child)) {
        for (const featureGuide of tile.featureGuide) {
          if (!featureGuide.parentChild) {
            const { source, layerID, count, offset, type, attributes } = featureGuide
            this.featureGuide.push({ parentChild: true, child, tile, source, layerID, count, offset, type, attributes })
          }
        }
      }
    }
    // Ensure to sort according to ID
    this.featureGuide.sort((a, b) => a.layerID - b.layerID)
  }

  injectVectorSourceData (source: string, vertexArray: Float32Array, indexArray: Uint32Array,
    featureIndexArray: Uint8Array, featureGuideArray: Uint32Array, layers: StyleLayers) {
    // store a reference to the source
    const builtSource = this.sourceData[source] = {
      type: 'vector',
      vertexArray,
      indexArray,
      featureIndexArray
    }
    // we work off the featureGuideArray, adding to the buffer as we go
    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerID, count, and offset, and update the index
      const [layerID, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // create and store the featureGuide
      this.featureGuide.push({
        parentChild: false,
        layerID,
        source,
        count,
        offset,
        type: layers[layerID].type,
        featureCode: new Float32Array([...featureGuideArray.slice(i, i + encodingSize)])
      })
      i += encodingSize
    }
    // Since a parent or children can be injected, we need to remove any instances of the "old" source data.
    this.featureGuide = this.featureGuide.filter(lg => !(lg.parentChild && lg.source === source))
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.featureGuide.sort((a, b) => a.layerID - b.layerID)
    // build the VAO
    this.buildVAO(builtSource)
  }

  _createDivision () {
    // the zoom determines the number of divisions necessary to maintain a visually
    // asthetic spherical shape. As we zoom in, the tiles are practically flat,
    // so division is less useful.
    // 0, 1 => 32  ;  2, 3 => 16  ;  4, 5 => 8  ;  6, 7 => 4  ;  8, 9 => 2  ;  10+ => 1
    const level = 1 << Math.max(Math.min(Math.floor(this.zoom / 2), 5), 0) // max 5 as its binary position is 32
    this.division = 32 / level
  }

  _buildBackgroundGeometry () {
    const { extent, context } = this
    const background = this.sourceData.background = {
      type: 'vector',
      vertexArray: new Float32Array([0, 0,  extent, 0,  0, extent,  extent, extent]),
      indexArray: new Uint32Array([0, 1, 2, 3]),
      drawMode: context.gl.TRIANGLE_STRIP
    }
    this.buildVAO(background)
  }

  _buildMaskGeometry () {
    const vertices = []
    const indices = []
    // find change in s and change in t
    const dt = this.bbox[2] - this.bbox[0]
    const ds = this.bbox[3] - this.bbox[1]
    // y = mx + b, we need to find the potential b for each tiles s and t
    const tB = this.bbox[1]
    const sB = this.bbox[0]
    // grab the appropriate tile constants, and prep variables
    const { division, face } = this
    const indexLength = division + 1
    let t: number, s: number, point: S2Point, index: number, indexAbove: number
    // now we can build out the vertices and indices
    // vertices
    for (let j = 0; j <= division; j++) {
      t = dt / division * j + tB
      for (let i = 0; i <= division; i++) {
        s = ds / division * i + sB
        // create s2Point using WebGL's projection scheme, normalize, and than store
        point = S2Point.fromSTGL(face, s, t)
        point.normalize()
        vertices.push(...point.toFloats()) // push 3d point data high and low (6 floats)
        vertices.push(i / division, j / division) // push x,y textcoord positions (2 floats)
      }
    }
    // indices
    for (let j = 0; j < division; j++) {
      // add degenerate if j is not 0
      if (j !== 0) indices.push((j + 1) * indexLength)
      for (let i = 0; i <= division; i++) {
        index = j * indexLength + i
        indexAbove = (j + 1) * indexLength + i
        indices.push(indexAbove, index)
      }
      // upon finishing a row, add a degenerate
      indices.push(index)
    }
    // create our initial vertices and indices:
    const mask = this.sourceData.mask = {
      type: 'vector',
      vertexArray: new Float32Array(vertices),
      indexArray: new Uint32Array(indices),
      drawMode: this.context.gl.TRIANGLE_STRIP
    }
    this.buildVAO(mask)
  }

  // TODO: For future 3D terrain geometry, we would create a new mask
  _injectNewMaskGeometry() {}

  buildVAO (source: VectorTileSource) {
    const { context } = this
    const { gl } = context
    // type vector
    if (source.type === 'vector') {
      // cleanup old setup
      if (source.vertexBuffer) gl.deleteBuffer(source.vertexBuffer)
      if (source.featureIndexBuffer) gl.deleteBuffer(source.featureIndexBuffer)
      if (source.indexBuffer) gl.deleteBuffer(source.indexBuffer)
      if (source.vao) context.deleteVertexArray(source.vao)
      // Create a starting vertex array object (attribute state)
      source.vao = context.createVertexArray()
      // and make it the one we're currently working with
      context.bindVertexArray(source.vao)
      // VERTEX
      // Create a vertex buffer
      source.vertexBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.vertexArray, gl.STATIC_DRAW)
      // link attributes:
      // fill
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0)
      // line
      gl.enableVertexAttribArray(1)
      gl.enableVertexAttribArray(2)
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 8, 0)
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 8, 4)
      // mask
      gl.enableVertexAttribArray(6)
      gl.enableVertexAttribArray(7)
      gl.enableVertexAttribArray(8)
      gl.vertexAttribPointer(6, 3, gl.FLOAT, false, 32, 0)
      gl.vertexAttribPointer(7, 3, gl.FLOAT, false, 32, 12)
      gl.vertexAttribPointer(8, 2, gl.FLOAT, false, 32, 24)
      // FEATURE INDEX
      if (source.featureIndexArray && source.featureIndexArray.length) {
        // Create the feature index buffer
        source.featureIndexBuffer = gl.createBuffer()
        // Bind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, source.featureIndexBuffer)
        // Buffer the data
        gl.bufferData(gl.ARRAY_BUFFER, source.featureIndexArray, gl.STATIC_DRAW)
        // link attribute
        gl.enableVertexAttribArray(5)
        // tell attribute how to get data out of feature index buffer
        gl.vertexAttribPointer(5, 1, gl.UNSIGNED_BYTE, false, 1, 0)
      }
      // INDEX
      // Create an index buffer
      source.indexBuffer = gl.createBuffer()
      // bind to ELEMENT_ARRAY
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, source.indexBuffer)
      // buffer the data
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indexArray, gl.STATIC_DRAW)
    }
  }

  buildFBO () {
    const { gl } = this.context
    const tileSize = this.size * this.scale
    // prep texture and framebuffer
    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, tileSize, tileSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    this.fbo = gl.createFramebuffer()
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.texture, 0)
  }
}

// if parent, than bbox is potentially inside bbox2
// if child, than bbox2 is potentially inside bbox
function bboxOverlap(bbox: BBOX, bbox2: BBOX, child: boolean): boolean {
  if (!child) {
    const tmp = bbox2
    bbox2 = bbox
    bbox = tmp
  }
  if (bbox[0] > bbox2[0] && bbox[0] < bbox2[2]) return true
  if (bbox[1] > bbox2[1] && bbox[1] < bbox2[3]) return true
  if (bbox[2] > bbox2[0] && bbox[2] < bbox2[2]) return true
  if (bbox[3] > bbox2[1] && bbox[3] < bbox2[3]) return true
  return false
}

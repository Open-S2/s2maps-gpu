// @flow
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import { S2Point, tileHash, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { Layer } from '../styleSpec'

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer/codeOffsetBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the attributes object is for dataConditions and dataRanges.
export type FeatureGuide = {
  parent?: boolean, // eslint-disable-next-line
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
  codeOffsetArray: Uint8Array,
  vertexBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  codeOffsetBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject,
  drawMode?: GLenum // gl.TRIANGLE_FAN, gl.TRIANGLE_STRIP, etc.
}

export type RasterTileSource = {
  type: 'raster',
  texture: WebGLTexture
}

// SourceData will either be the current tiles VectorTileSource, RasterTileSource,
// or reference tile(s) to be masked + created.
// eslint-disable-next-line
export type SourceData = { [string | number]: RasterTileSource | VectorTileSource | Array<Tile> }

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
  bbox: [number, number, number, number]
  faceST: Float32Array
  division: number
  sourceData: SourceData = {}
  featureGuide: Array<FeatureGuide> = []
  children: Array<Tile>
  context: WebGL2Context | WebGLContext
  constructor (context: WebGL2Context | WebGLContext, face: number, zoom: number,
    x: number, y: number, hash: number, size?: number = 512, children?: Array<Tile>) {
    this.context = context
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.size = size
    if (children) this.children = children
    const bbox = this.bbox = bboxST(x, y, zoom)
    this.faceST = new Float32Array([face, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]])
    this._createDivision()
    this._buildMaskGeometry()
  }

  destroy () {
    const { gl } = this.context
    for (const sourceName in this.sourceData) {
      const source = this.sourceData[sourceName]
      if (source.type === 'vector') {
        if (source.vertexBuffer) gl.deleteBuffer(source.vertexBuffer)
        if (source.codeOffsetBuffer) gl.deleteBuffer(source.codeOffsetBuffer)
        if (source.indexBuffer) gl.deleteBuffer(source.indexBuffer)
        if (source.vao) this.context.deleteVertexArray(source.vao)
      } else if (source.type === 'raster') {
        if (source.texture) gl.deleteTexture(source.texture)
      }
    }
  }

  injectParentTile (tileCache: TileCache) {
    // corner case, we are at min zoom
    if (this.zoom === 0) return
    // get closest parent hash. Max distance of 3 zooms
    const parentHash = tileHash(this.face, this.zoom - 1, Math.floor(this.x / 2), Math.floor(this.y / 2))
    // check if parent tile exists, if so inject
    if (tileCache.has(parentHash)) {
      const parent = tileCache.get(parentHash)
      // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
      // a parents' parent or deeper, so we need to reflect that int the tile property
      for (const featureGuide of parent.featureGuide) {
        const { tile, source, layerID, count, offset, type, featureCode } = featureGuide
        this.featureGuide.push({ parent: true, tile: (tile) ? tile : parent, source, layerID, count, offset, type, featureCode })
      }
      this.featureGuide.sort((a, b) => a.layerID - b.layerID)
    }
  }

  // if a style has a raster source & layer pointing to it, we request the tiles
  // four children (if size is 512 and images are 512, otherwise we may store
  // 16 images of 256). Create a texture of size this.size x this.size to house
  // said data.
  buildSourceTexture (source: string, layer: Layer) {
    const { gl } = this.context
    const { mask } = this.sourceData
    // Build sourceData
    const raster = this.sourceData[source] = {
      type: 'raster'
    }
    // Create a texture.
    const texture = raster.texture = gl.createTexture()
    // store information to featureGuide
    this.featureGuide.push({
      parent: false,
      layerID: 0,
      source: 'mask', // when pulling from the vao, we still use the mask vertices
      count: mask.indexArray.length,
      type: 'raster',
      texture
    })
    // setup texture params
    const length = this.size * 2
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, length, length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    // setup image requests
    const { face, zoom, x, y } = this
    const pieces = [
      { face, zoom: zoom + 1, x: x * 2, y: y * 2, leftShift: 0, bottomShift: 0 },
      { face, zoom: zoom + 1, x: x * 2 + 1, y: y * 2, leftShift: 1, bottomShift: 0 },
      { face, zoom: zoom + 1, x: x * 2, y: y * 2 + 1, leftShift: 0, bottomShift: 1 },
      { face, zoom: zoom + 1, x: x * 2 + 1, y: y * 2 + 1, leftShift: 1, bottomShift: 1 }
    ]

    return pieces
  }

  _injectRasterData (source: string, image: Image, leftShift: number, bottomShift: number) {
    const { gl } = this.context
    const length = image.width
    const { texture } = this.sourceData[source]
    // put into texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, leftShift * length, bottomShift * length, gl.RGBA, gl.UNSIGNED_BYTE, image)
  }

  injectVectorSourceData (source: string, vertexArray: Float32Array, indexArray: Uint32Array,
    codeOffsetArray: Uint8Array, featureGuideArray: Uint32Array, layers: Array<Layer>) {
    // store a reference to the source
    const builtSource = this.sourceData[source] = {
      type: 'vector',
      vertexArray,
      indexArray,
      codeOffsetArray
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
        parent: false,
        layerID,
        source,
        count,
        offset,
        type: layers[layerID].type,
        featureCode: new Float32Array([...featureGuideArray.slice(i, i + encodingSize)])
      })
      i += encodingSize
    }
    // Since a parent can be injected, we need to remove any instances of the "old" source data.
    this.featureGuide = this.featureGuide.filter(lg => !(lg.parent && lg.source === source))
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.featureGuide.sort((a, b) => {
      return a.layerID - b.layerID
    })
    // build the VAO
    this.buildVAO(builtSource)
    // if children, store featureGuide in each child
    if (this.children) this._injectSourceInChildren()
  }

  _injectSourceInChildren (sourceInject: string) {
    // for all children, copy this tiles featureGuide over
    for (const child of this.children) {
      for (const featureGuide of this.featureGuide) {
        const { source, layerID, count, offset, type, featureCode } = featureGuide
        if (source === sourceInject) child.featureGuide.push({ parent: true, tile: this, source, layerID, count, offset, type, featureCode })
      }
    }
    // flush the children out, as we don't need to keep anymore
    this.children = null
  }

  _createDivision () {
    // the zoom determines the number of divisions necessary to maintain a visually
    // asthetic spherical shape. As we zoom in, the tiles are practically flat,
    // so division is less useful.
    // 0, 1 => 32  ;  2, 3 => 16  ;  4, 5 => 8  ;  6, 7 => 4  ;  8, 9 => 2  ;  10+ => 1
    const level = 1 << Math.max(Math.min(Math.floor(this.zoom / 2), 5), 0) // max 5 as its binary position is 32
    this.division = 32 / level
  }

  _buildMaskGeometry () {
    const vertices = []
    const indices = []
    // grab the appropriate tile constants, and prep variables
    const { division, face } = this
    const indexLength = division + 1
    let t: number, s: number, point: S2Point, index: number, indexAbove: number
    // now we can build out the vertices and indices
    // vertices
    for (let j = 0; j <= division; j++) {
      t = 1 / division * j
      for (let i = 0; i <= division; i++) {
        s = 1 / division * i
        // create s2Point using WebGL's projection scheme, normalize, and than store
        point = S2Point.fromSTGL(face, s, t)
        point.normalize()
        vertices.push(s, t) // push 3d point data high and low (6 floats)
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
      if (source.codeOffsetBuffer) gl.deleteBuffer(source.codeOffsetBuffer)
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
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 0)
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 16, 8)
      // gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 16, 12)
      // FEATURE INDEX
      if (source.codeOffsetArray && source.codeOffsetArray.length) {
        // Create the feature index buffer
        source.codeOffsetBuffer = gl.createBuffer()
        // Bind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, source.codeOffsetBuffer)
        // Buffer the data
        gl.bufferData(gl.ARRAY_BUFFER, source.codeOffsetArray, gl.STATIC_DRAW)
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
}

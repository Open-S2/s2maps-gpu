// @flow
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { Layer, Mask } from '../styleSpec'

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
  featureCode: Float32Array,
  layerCode: Float32Array
}

export type VectorTileSource = {
  type: 'vector',
  vertexArray: Float32Array,
  radiiArray?: Float32Array,
  indexArray: Uint32Array,
  codeOffsetArray: Uint8Array,
  vertexBuffer?: WebGLBuffer,
  radiiBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  codeOffsetBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject,
  mode?: GLenum // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
}

export type TextureMapTileSource = {
  type: 'text',
  vertexArray: Float32Array,
  texPositionArray: Uint16Array,
  imageBitmap: ImageBitmap,
  texture: WebGLTexture,
  vertexBuffer?: WebGLBuffer,
  texPositionBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject
}

export type RasterTileSource = {
  type: 'raster',
  texture: WebGLTexture,
  mode?: GLenum // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
}

export type ChildRequest = { // eslint-disable-next-line
  [string | number]: Array<Tile> // layerID (hash):
}

// SourceData will either be the current tiles VectorTileSource, RasterTileSource,
// or reference tile(s) to be masked + created.
// eslint-disable-next-line
export type SourceData = { [string | number]: RasterTileSource | VectorTileSource | Array<Tile> }

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously place spherical background
// data to ensure we get no awkward visuals.
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
  context: WebGL2Context | WebGLContext
  childrenRequests: ChildRequest = {}
  constructor (context: WebGL2Context | WebGLContext, face: number, zoom: number,
    x: number, y: number, hash: number, size?: number = 512) {
    this.context = context
    this.face = face
    this.zoom = zoom
    this.x = x
    this.y = y
    this.id = hash
    this.size = size
    const bbox = this.bbox = bboxST(x, y, zoom)
    this.faceST = new Float32Array([face, zoom, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]])
    this._createDivision()
    this._buildMaskGeometry()
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that int the tile property. The other case
  // is the tile wants to display a layer that exists in a 'lower' zoom than this one.
  injectParentTile (parentTile: Tile, filterLayers?: Array<number>) {
    const foundLayers = new Set()
    for (const featureGuide of parentTile.featureGuide) {
      const { parent, tile, source, layerID, count, offset, type, layerCode, featureCode, texture } = featureGuide
      if (type === 'raster' && parent) continue
      if (!parent) foundLayers.add(layerID)
      this.featureGuide.push({ parent: true, tile: (tile) ? tile : parentTile, source, layerID, count, offset, type, layerCode, featureCode, texture })
    }
    this.featureGuide.sort((a, b) => a.layerID - b.layerID)
    // if filterLayers, we need to check what layers were missing
    if (filterLayers) {
      const missingLayers = filterLayers.filter(layerID => !foundLayers.has(layerID))
      for (const missingLayer of missingLayers) {
        if (!parentTile.childrenRequests[missingLayer]) parentTile.childrenRequests[missingLayer] = []
        parentTile.childrenRequests[missingLayer].push(this)
      }
    }
    // lastly inject text
    for (const source in parentTile.sourceData) {
      const parentSource = parentTile.sourceData[source]
      if (parentSource.type === 'text') this.sourceData[source] = parentSource
    }
  }

  // if a style has a raster source & layer pointing to it, we request the tiles
  // four children (if size is 512 and images are 512, otherwise we may store
  // 16 images of 256). Create a texture of size length x length to house
  // said data (length being this.size * 2).
  buildSourceTexture (source: string, layer: Layer) {
    const { gl } = this.context
    // Build sourceData
    const raster = this.sourceData[source] = { type: 'raster' }
    // Create a texture.
    const texture = raster.texture = gl.createTexture()
    // store information to featureGuide
    const guide = raster.guide = {
      parent: false,
      layerID: layer.index,
      source: 'mask', // when pulling from the vao, we still use the mask vertices
      type: 'raster',
      texture
    }
    this.featureGuide.push(guide)
    this.buildSource(raster)
  }

  injectRasterData (source: string, image: Image, leftShift: number, bottomShift: number) {
    const { gl } = this.context
    const length = image.width
    const currentSource = this.sourceData[source]
    const { texture } = currentSource
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
      // grab the layers type and code
      const { type, code } = layers[layerID]
      // create and store the featureGuide
      this.featureGuide.push({
        parent: false,
        layerID,
        source,
        count,
        offset,
        type,
        featureCode: new Float32Array([...featureGuideArray.slice(i, i + encodingSize)]),
        layerCode: code
      })
      i += encodingSize
    }
    // Since a parent can be injected, we need to remove any instances of the "old" source data.
    this.featureGuide = this.featureGuide.filter(fg => !(fg.parent && fg.source === source))
    // because sources may be utilized in an out of order fashion inside the style.layers property,
    // but come in linearly, we need to sort.
    this.featureGuide.sort((a, b) => { return a.layerID - b.layerID })
    // build the VAO
    this.buildSource(builtSource)
    // if we have children requesting this tiles data, we send the data over
    if (Object.keys(this.childrenRequests).length) this._injectSourceIntoChildren(source)
  }

  injectTextSourceData (source: string, vertexArray: Float32Array, texPositionArray: Uint16Array,
    imageBitmap: ImageBitmap) {
    const textSource = `${source}:text`
    // create the source. This will naturally replace whatever was already there
    const builtSource = this.sourceData[textSource] = {
      type: 'text',
      texture: this.context.gl.createTexture(),
      vertexArray,
      texPositionArray,
      imageBitmap
    }
    // build the VAO
    this.buildSource(builtSource)
  }

  _injectSourceIntoChildren (sourceName: string) {
    // clean the children's current featureGuide's of said layer
    for (let layerID in this.childrenRequests) {
      layerID = +layerID
      for (const tile of this.childrenRequests[layerID]) {
        tile.featureGuide = tile.featureGuide.filter(fg => !(fg.parent && fg.layerID === layerID))
      }
    }
    // run through every layer in the guide and see if any of the tiles need said layer
    for (const featureGuide of this.featureGuide) {
      if (featureGuide.source === sourceName && this.childrenRequests[featureGuide.layerID]) {
        for (const tile of this.childrenRequests[featureGuide.layerID]) {
          // first remove all instances of source
          const { source, layerID, count, offset, type, layerCode, featureCode, texture } = featureGuide
          tile.featureGuide.push({ parent: true, tile: this, source, layerID, count, offset, type, layerCode, featureCode, texture })
          tile.featureGuide.sort((a, b) => { return a.layerID - b.layerID })
        }
        // cleanup
        delete this.childrenRequests[featureGuide.layerID]
      }
    }
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
      mode: this.context.gl.TRIANGLE_STRIP
    }
    this.buildSource(mask)
  }

  // For future 3D terrain geometry, we create a new mask
  injectMaskGeometry (vertexArray: Float32Array, indexArray: Uint32Array,
    radiiArray: Float32Array, styleMask: Mask) {
    const mask = this.sourceData.mask = {
      type: 'vector',
      vertexArray,
      indexArray,
      radiiArray,
      threeD: true,
      mode: this.context.gl.TRIANGLES
    }
    this.buildSource(mask)
  }

  buildSource (source: RasterTileSource | VectorTileSource | TextureMapTileSource) {
    const { context } = this
    const { gl } = context
    // type vector
    if (source.type === 'vector') {
      // cleanup old setup
      if (source.vertexBuffer) gl.deleteBuffer(source.vertexBuffer)
      if (source.radiiBuffer) gl.deleteBuffer(source.radiiBuffer)
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
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      // line
      gl.enableVertexAttribArray(1)
      gl.enableVertexAttribArray(2)
      gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 16, 0)
      gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 16, 8)
      // gl.vertexAttribPointer(3, 1, gl.FLOAT, false, 16, 12)
      // RADII
      if (source.radiiArray) {
        // Create a vertex buffer
        source.radiiBuffer = gl.createBuffer()
        // Bind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, source.radiiBuffer)
        // Buffer the data
        gl.bufferData(gl.ARRAY_BUFFER, source.radiiArray, gl.STATIC_DRAW)
        // radii attribute
        gl.enableVertexAttribArray(6)
        // tell attribute how to get data out of radii buffer
        gl.vertexAttribPointer(6, 1, gl.FLOAT, false, 0, 0)
      }
      // FEATURE INDEX
      if (source.codeOffsetArray && source.codeOffsetArray.length) {
        // Create the feature index buffer
        source.codeOffsetBuffer = gl.createBuffer()
        // Bind the buffer
        gl.bindBuffer(gl.ARRAY_BUFFER, source.codeOffsetBuffer)
        // Buffer the data
        gl.bufferData(gl.ARRAY_BUFFER, source.codeOffsetArray, gl.STATIC_DRAW)
        // feature attribute
        gl.enableVertexAttribArray(7)
        gl.enableVertexAttribArray(8)
        // tell attribute how to get data out of feature index buffer
        gl.vertexAttribPointer(7, 1, gl.UNSIGNED_BYTE, false, 2, 0)
        gl.vertexAttribPointer(8, 1, gl.UNSIGNED_BYTE, false, 2, 1)
      }
      // INDEX
      // Create an index buffer
      source.indexBuffer = gl.createBuffer()
      // bind to ELEMENT_ARRAY
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, source.indexBuffer)
      // buffer the data
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, source.indexArray, gl.STATIC_DRAW)
    } else if (source.type === 'text') {
      // VERTEX
      // Create a vertex buffer
      source.vertexBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.vertexBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.vertexArray, gl.STATIC_DRAW)
      // TEXTURE POSITION
      // Create a tex buffer
      source.texPositionBuffer = gl.createBuffer()
      // Bind the buffer
      gl.bindBuffer(gl.ARRAY_BUFFER, source.texPositionBuffer)
      // Buffer the data
      gl.bufferData(gl.ARRAY_BUFFER, source.texPositionArray, gl.STATIC_DRAW)
      // link attributes:
      // s & t positions
      gl.enableVertexAttribArray(0)
      gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
      // texture width & height & anchor & id
      gl.enableVertexAttribArray(1)
      gl.vertexAttribPointer(1, 2, gl.UNSIGNED_SHORT, false, 24, 0)
      // texture x & y data
      gl.enableVertexAttribArray(2)
      gl.vertexAttribPointer(2, 2, gl.UNSIGNED_SHORT, false, 24, 8)
      // add divisors to reuse positions
      gl.vertexAttribDivisor(0, 4) // s & t
      gl.vertexAttribDivisor(1, 4) // texture width & height & anchor & id
      // TEXTURE
      gl.bindTexture(gl.TEXTURE_2D, source.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source.imageBitmap)
      // gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, source.width, source.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, source.imageData)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    } else if (source.type === 'raster') {
      // setup texture params
      const length = this.size * 2
      gl.bindTexture(gl.TEXTURE_2D, source.texture)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, length, length, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
      if (navigator.userAgent.indexOf('Chrome') === -1) {
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)
      }
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    }
  }
}

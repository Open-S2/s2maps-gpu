// @flow
import { WebGL2Context, WebGLContext } from '../gl/contexts'
import buildSource from './buildSource'
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { Layer, Mask } from '../styleSpec'

export type VectorTileSource = {
  type: 'vector',
  subType: 'fill' | 'line',
  vertexArray: Float32Array,
  radiiArray?: Float32Array,
  indexArray: Uint32Array,
  codeTypeArray: Uint8Array,
  typeArray?: Float32Array,
  typeBuffer?: WebGLBuffer,
  vertexBuffer?: WebGLBuffer,
  radiiBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  codeTypeBuffer?: WebGLBuffer,
  vao?: WebGLVertexArrayObject,
  mode?: GLenum // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
}

export type GlyphTileSource = {
  type: 'glyph',
  uvArray: Float32Array,
  stepArray: Float32Array,
  textureID: number,
  height: number,
  glyphFilterVertices: Float32Array,
  glyphFillVertices: Float32Array,
  glyphFillIndices: Uint32Array,
  glyphLineVertices: Float32Array,
  glyphLineTypeArray: Float32Array,
  glyphQuads: Float32Array,
  filterVAO?: WebGLVertexArrayObject,
  glyphFillVAO?: WebGLVertexArrayObject,
  glyphLineVAO?: WebGLVertexArrayObject,
  vao?: WebGLVertexArrayObject, // quad vao
  uvBuffer?: WebGLBuffer,
  stepBuffer?: WebGLBuffer,
  glyphFilterBuffer?: WebGLBuffer,
  glyphFillVertexBuffer?: WebGLBuffer,
  glyphLineVertexBuffer?: WebGLBuffer,
  glyphLineTypeBuffer?: WebGLBuffer,
  glyphIndexBuffer?: WebGLBuffer,
  glyphQuadBuffer?: WebGLBuffer
}

export type RasterTileSource = {
  type: 'raster',
  size: number,
  texture: WebGLTexture,
  mode?: GLenum // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
}

// The layer guide helps identify how to properly draw from the vertexBuffer/vertexIndex stack.
// All layers are merged into one VAO/indexBuffer/vertexBuffer/codeTypeBuffer set. This reduces complexity and improves draw speed.
// To ensure we draw in order and know the index ranges exist per layer, we maintain a 'Layer Guide'.
// the attributes object is for dataConditions and dataRanges.
export type FeatureGuide = { // eslint-disable-next-line
  tile: Tile,
  parent: boolean,
  layerID: number,
  source: VectorTileSource | GlyphTileSource | RasterTileSource,
  sourceName: string,
  faceST: Float32Array,
  count: number,
  offset: number,
  filterOffset?: number, // glyph
  filterCount?: number, // glyph
  type: string,
  featureCode: Float32Array,
  layerCode: Float32Array
}

export type ChildRequest = { // eslint-disable-next-line
  [string | number]: Array<Tile> // layerID (hash):
}

// eslint-disable-next-line
export type SourceData = { [string | number]: RasterTileSource | VectorTileSource | GlyphTileSource }

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously build spherical background
// data to ensure we get no awkward visuals.
export default class Tile {
  id: number
  face: Face
  zoom: number
  x: number
  y: number
  size: number
  tmpMaskID: number
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

  // the zoom determines the number of divisions necessary to maintain a visually
  // asthetic spherical shape. As we zoom in, the tiles are practically flat,
  // so division is less useful.
  // 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
  _createDivision () {
    const level = 1 << Math.max(Math.min(Math.floor(this.zoom / 2), 4), 0) // max 5 as its binary position is 32
    this.division = 16 / level
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that int the tile property. The other case
  // is the tile wants to display a layer that exists in a 'lower' zoom than this one.
  injectParentTile (parentTile: Tile, filterLayers?: Array<number>) {
    // for (const feature of parentTile.featureGuide) {
    //   if (!feature.parent) this.featureGuide.push({ ...feature, tile: this, parent: true })
    // }
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
      t = 4096 / division * j
      for (let i = 0; i <= division; i++) {
        s = 4096 / division * i
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
      subType: 'fill',
      vertexArray: new Int16Array(vertices),
      indexArray: new Uint32Array(indices),
      count: indices.length,
      mode: this.context.gl.TRIANGLE_STRIP
    }
    buildSource(this.context, mask)
  }

  // For future 3D terrain geometry, we create a new mask
  injectMaskGeometry (vertexArray: Int16Array, indexArray: Uint32Array,
    radiiArray: Float32Array, styleMask: Mask) {
    const mask = this.sourceData.mask = {
      type: 'vector',
      subType: 'fill',
      vertexArray,
      indexArray,
      radiiArray,
      count: indexArray.length,
      threeD: true,
      mode: this.context.gl.TRIANGLES
    }
    buildSource(this.context, mask)
  }

  // if a style has a raster source & layer pointing to it, we request the tiles
  // four children (if size is 512 and images are 512, otherwise we may store
  // 16 images of 256). Create a texture of size length x length to house
  // said data (length being this.size * 2).
  injectRasterData (sourceName: string, layerIDs: Array<number>, image: Image,
    leftShift: number, bottomShift: number) {
    const { gl } = this.context
    const length = image.width
    // prep the source
    let rasterSource = this.sourceData[sourceName]
    // prep phase (should the source not exist)
    if (!rasterSource) {
      rasterSource = this.sourceData[sourceName] = {
        type: 'raster',
        size: this.size,
        total: Math.pow((this.size * 2) / length, 2),
        count: 0,
        texture: gl.createTexture()
      }
      buildSource(this.context, rasterSource)
      // store texture information to featureGuide
      for (const layerID of layerIDs) {
        const guide = {
          tile: this,
          faceST: this.faceST,
          layerID: layerID,
          source: this.sourceData,
          sourceName: 'mask',
          subType: 'fill',
          type: 'raster',
          featureCode: [0],
          texture: rasterSource.texture
        }
        this.featureGuide.push(guide)
      }
    }
    // pull out the texture
    const { texture } = rasterSource
    // store in texture
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, leftShift * length, bottomShift * length, gl.RGBA, gl.UNSIGNED_BYTE, image)
    rasterSource.count++
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    if (rasterSource.count === rasterSource.total) this.featureGuide = this.featureGuide.filter(fg => !(fg.sourceName === sourceName && fg.parent))
  }

  injectVectorSourceData (sourceName: string, vertexArray: Int16Array, indexArray?: Uint32Array,
    codeTypeArray: Uint8Array, featureGuideArray: Uint32Array, layers: Array<Layer>): VectorTileSource {
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    this.featureGuide = this.featureGuide.filter(fg => !(fg.sourceName === sourceName))
    // store a reference to the source
    const vectorSource = this.sourceData[sourceName] = {
      type: 'vector',
      subType: sourceName.split(':').pop(),
      vertexArray,
      indexArray,
      codeTypeArray
    }
    // we work off the featureGuideArray, adding to the buffer as we go
    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerID, count, and offset, and update the index
      const [layerID, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // grab the layers type and code
      const { type, code, lch } = layers[layerID]
      // create and store the featureGuide
      this.featureGuide.push({
        tile: this,
        faceST: this.faceST,
        layerID,
        source: this.sourceData,
        sourceName,
        count,
        offset,
        type,
        featureCode: new Float32Array(encodingSize ? [...featureGuideArray.slice(i, i + encodingSize)] : [0]), // NOTE: The sorting algorithm doesn't work if an array is empty, so we have to have at least one number, just set it to 0
        layerCode: code,
        lch
      })
      i += encodingSize
    }
    // build the VAO
    buildSource(this.context, vectorSource)
    // return the source
    return vectorSource
  }

  injectGlyphSourceData (sourceName: string, glyphFilterVertices: Float32Array,
    glyphFillVertices: Float32Array, glyphFillIndices: Float32Array,
    glyphLineVertices: Float32Array, glyphQuads: Float32Array,
    layerGuideBuffer: Uint32Array, layers: Array<Layer>): GlyphTileSource {
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    this.featureGuide = this.featureGuide.filter(fg => !(fg.sourceName === sourceName))
    // if (this.face === 4 && this.zoom === 4 && this.x === 0 && this.y === 6) console.log('POST INJECT', this.featureGuide)
    // setup source data
    const glyphSource = this.sourceData[sourceName] = {
      type: 'glyph',
      uvArray: new Float32Array([0, 0,  1, 0,  1, 1,  0, 1]),
      stepArray: new Float32Array([0, 1]),
      textureID: layerGuideBuffer[0],
      height: layerGuideBuffer[1],
      glyphFilterVertices,
      glyphFillVertices,
      glyphFillIndices,
      glyphLineVertices,
      glyphQuads
    }

    // LayerCode: layerID, offset, count, codeLength, code
    // we work off the layerGuideBuffer, adding to the buffer as we go
    const lgl = layerGuideBuffer.length
    let i = 2
    while (i < lgl) {
      // grab the size, layerID, count, and offset, and update the index
      // layerID, filterOffset, filterCount, quadOffset, quadCount, codeLength, code
      const [layerID, filterOffset, filterCount, offset, count, encodingSize] = layerGuideBuffer.slice(i, i + 6)
      i += 6
      // grab the layers type and code
      const { code, lch } = layers[layerID]
      // create and store the featureGuide
      this.featureGuide.push({
        tile: this,
        faceST: this.faceST,
        layerID,
        source: this.sourceData,
        sourceName,
        filterOffset,
        filterCount,
        offset,
        count,
        type: 'glyph',
        featureCode: new Float32Array(encodingSize ? [...layerGuideBuffer.slice(i, i + encodingSize)] : [0]),
        layerCode: code,
        lch
      })
      i += encodingSize
    }

    // build the VAO
    buildSource(this.context, glyphSource)
    // return the source
    return glyphSource
  }
}

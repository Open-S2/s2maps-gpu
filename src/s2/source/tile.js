// @flow
/* global WebGLBuffer WebGLTexture WebGLVertexArrayObject GLenum Image */
import Context from '../gl/contexts'
import buildSource, { buildGlyphSource } from './buildSource'
import { bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { Layer, Mask } from '../style/styleSpec'
import type { ProgramType } from '../gl/programs/program'

export type VectorTileSource = {
  type: 'vector',
  subType: 'fill' | 'line' | 'point',
  vertexArray: Int16Array,
  radiiArray?: Float32Array,
  indexArray: Uint32Array,
  codeTypeArray: Uint8Array,
  typeArray?: Float32Array,
  typeBuffer?: WebGLBuffer,
  vertexBuffer?: WebGLBuffer,
  radiiBuffer?: WebGLBuffer,
  indexBuffer?: WebGLBuffer,
  codeTypeBuffer?: WebGLBuffer,
  threeD?: boolean,
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
  glyphFillIndexBuffer?: WebGLBuffer,
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
  maskLayer: boolean, // if maskLayer we won't be sharing the layer as it is added during tile build
  parent: boolean,
  layerIndex: number,
  source: VectorTileSource | GlyphTileSource | RasterTileSource,
  sourceName: string,
  faceST: Float32Array,
  count: number,
  offset: number,
  filterOffset?: number, // glyph
  filterCount?: number, // glyph
  type: ProgramType,
  depthPos?: number,
  featureCode: Float32Array,
  subFeatureCode?: Float32Array,
  layerCode: Float32Array,
  mode?: GLenum, // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
  lch?: boolean
}

export type ChildRequest = { // eslint-disable-next-line
  [string | number]: Array<Tile> // layerIndex (hash):
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
  heatmapGuide: Array<FeatureGuide> = []
  featureGuide: Array<FeatureGuide> = []
  context: Context
  childrenRequests: ChildRequest = {}
  interactiveGuide: Map<number, Object> = new Map()
  constructor (context: Context, face: number, zoom: number,
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
    this._getMaskSource()
  }

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete () {
    // remove all features
    this.featureGuide = []
    this.interactiveGuide = new Map()
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that int the tile property. The other case
  // is the tile wants to display a layer that exists in a 'lower' zoom than this one.
  injectParentTile (parentTile: Tile, permParent: boolean, filterLayers?: Array<number>) {
    // const foundLayers = new Set()
    // for (const feature of parentTile.featureGuide) {
    //   const { maskLayer, type, parent, layerIndex } = feature
    //   if (maskLayer) continue // ignore mask features
    //   if (!parent) foundLayers.add(layerIndex)
    //   if (type !== 'glyph') this.featureGuide.push({ ...feature, tile: this, permParent })
    // }
    // // if filterLayers, we need to check what layers were missing
    // if (filterLayers) {
    //   const missingLayers = filterLayers.filter(layerIndex => !foundLayers.has(layerIndex))
    //   for (const missingLayer of missingLayers) {
    //     if (!parentTile.childrenRequests[missingLayer]) parentTile.childrenRequests[missingLayer] = []
    //     parentTile.childrenRequests[missingLayer].push(this)
    //   }
    // }
  }

  injectMaskLayers (layers: Array<Layer>) {
    const { zoom } = this // $FlowIgnore
    for (const layer of layers) {
      const { minzoom, maxzoom, depthPos, opaque, layerIndex, type, code, lch, paint } = layer
      if (zoom < minzoom) continue
      if (zoom > maxzoom) continue // $FlowIgnore
      const feature: FeatureGuide = {
        maskLayer: true,
        tile: this,
        faceST: this.faceST,
        layerIndex,
        source: this.sourceData,
        sourceName: 'mask',
        subType: 'fill',
        count: this.sourceData.mask.count,
        type,
        depthPos,
        opaque,
        featureCode: new Float32Array([0]), // NOTE: The sorting algorithm doesn't work if an array is empty, so we have to have at least one number, just set it to 0
        layerCode: code,
        lch,
        mode: this.sourceData.mask.mode
      }
      if (this.context.type === 1 && paint) feature.color = (paint.color(null, null, this.zoom)).getRGB()
      this.featureGuide.push(feature)
    }
  }

  // the zoom determines the number of divisions necessary to maintain a visually
  // asthetic spherical shape. As we zoom in, the tiles are practically flat,
  // so division is less useful.
  // 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
  // context.getMask will have the division set to 16 / level
  // context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
  _getMaskSource () {
    const { context, zoom } = this
    const level = 1 << Math.max(Math.min(Math.floor(zoom / 2), 4), 0) // max 4 as its level is 16
    const division = this.division = 16 / level
    this.sourceData.mask = context.getMask(level, division)
  }

  // For default mask geometry OR for future 3D terrain geometry
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
  injectRasterData (sourceName: string, layerIndexs: Array<number>, image: Image,
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
      for (const layerIndex of layerIndexs) {
        const guide = {
          tile: this,
          faceST: this.faceST,
          layerIndex: layerIndex,
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

  injectVectorSourceData (sourceName: string, vertexArray: Float32Array, indexArray?: Uint32Array,
    codeTypeArray: Uint8Array, featureGuideArray: Float32Array, layers: Array<Layer>): VectorTileSource {
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    // however, ignore data that is pulled from a parent that doesn't exist at this zoom
    this.featureGuide = this.featureGuide.filter(fg => !(fg.sourceName === sourceName && !fg.permParent))
    // store a reference to the source
    const subType = sourceName.split(':').pop()
    const vectorSource = this.sourceData[sourceName] = {
      type: 'vector',
      subType,
      vertexArray,
      indexArray,
      codeTypeArray
    }
    // we work off the featureGuideArray, adding to the buffer as we go
    const lgl = featureGuideArray.length
    let i = 0
    while (i < lgl) {
      let cap
      // if line, grab the cap type
      if (subType === 'line') {
        cap = featureGuideArray[i]
        i++
      }
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, count, offset, encodingSize] = featureGuideArray.slice(i, i + 4)
      i += 4
      // build featureCode
      const featureCode = new Float32Array(encodingSize ? [...featureGuideArray.slice(i, i + encodingSize)] : [0])
      // grab the layers type and code
      const { type, invert, depthPos, opaque, code, lch, colorRamp } = layers[layerIndex]
      // create and store the featureGuide
      const feature = {
        tile: this,
        faceST: this.faceST,
        layerIndex,
        source: this.sourceData,
        sourceName,
        count,
        offset,
        type,
        invert,
        cap,
        depthPos,
        opaque,
        featureCode, // NOTE: The sorting algorithm doesn't work if an array is empty, so we have to have at least one number, just set it to 0
        layerCode: code,
        lch,
        colorRamp
      }
      // update index
      i += encodingSize
      // if webgl1, we have color (and width if line) data
      if (this.context.type === 1) {
        feature.color = feature.subFeatureCode = feature.featureCode // default subFeatureCode is for fill which is only color
        const subEncodingSize = featureGuideArray[i]
        i++
        feature.featureCode = new Float32Array(subEncodingSize ? [...featureGuideArray.slice(i, i + subEncodingSize)] : [0])
        i += subEncodingSize
        if (subType === 'line') {
          feature.color = feature.subFeatureCode.slice(0, 4)
          feature.width = feature.subFeatureCode[4]
        } else if (subType === 'point') {
          feature.color = feature.subFeatureCode.slice(0, 4)
          feature.radius = feature.subFeatureCode[4]
          feature.stroke = feature.subFeatureCode.slice(5, 9)
          feature.strokeWidth = feature.subFeatureCode[9]
        } else if (subType === 'heatmap') {
          feature.radius = feature.subFeatureCode[0]
          feature.opacity = feature.subFeatureCode[1]
          feature.intensity = feature.subFeatureCode[2]
        }
      }
      // store
      if (subType === 'heatmap') this.heatmapGuide.push(feature)
      else this.featureGuide.push(feature)
      // if a lower zoom tile needs this feature, we add
      const childRequest = this.childrenRequests[layerIndex]
      if (childRequest && childRequest.length) for (const tile of childRequest) tile.featureGuide.push({ ...feature, tile, parent: this, permParent: true })
    }
    // build the VAO
    buildSource(this.context, vectorSource)
    // return the source
    return vectorSource
  }

  injectGlyphSourceData (sourceName: string, glyphFilterVertices: Float32Array,
    glyphFillVertices: Float32Array, glyphFillIndices: Float32Array,
    glyphLineVertices: Float32Array, glyphQuads: Float32Array,
    layerGuideBuffer: Float32Array, layers: Array<Layer>): GlyphTileSource {
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    this.featureGuide = this.featureGuide.filter(fg => !(fg.sourceName === sourceName))

    // LayerCode: layerIndex, offset, count, codeLength, code
    // we work off the layerGuideBuffer, adding to the buffer as we go
    const lgl = layerGuideBuffer.length
    let i = 2
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      // layerIndex, filterOffset, filterCount, quadOffset, quadCount, codeLength, code
      const [layerIndex, filterOffset, filterCount, offset, count, encodingSize] = layerGuideBuffer.slice(i, i + 6)
      i += 6
      // grab the layers type and code
      const { depthPos, code, lch, interactive } = layers[layerIndex]
      // create and store the featureGuide
      const feature = {
        tile: this,
        faceST: this.faceST,
        layerIndex,
        source: this.sourceData,
        sourceName,
        filterOffset,
        filterCount,
        offset,
        count,
        type: 'glyph',
        depthPos,
        featureCode: new Float32Array(encodingSize ? [...layerGuideBuffer.slice(i, i + encodingSize)] : [0]),
        layerCode: code,
        interactive,
        lch
      }
      i += encodingSize
      // if WebGL1 - we also have to grab the fill, stroke, and strokeWidth
      if (this.context.type === 1) {
        // get fill, stroke, and stroke width. Increment
        feature.size = layerGuideBuffer[i]
        feature.fill = layerGuideBuffer.slice(i + 1, i + 5)
        feature.stroke = layerGuideBuffer.slice(i + 5, i + 9)
        feature.strokeWidth = layerGuideBuffer[i + 9]
        i += 10
      }
      // store feature
      this.featureGuide.push(feature)
    }

    // setup source data
    const glyphSource = this.sourceData[sourceName] = buildGlyphSource(
      this.context, layerGuideBuffer, glyphFilterVertices, glyphFillVertices,
      glyphFillIndices, glyphLineVertices, glyphQuads
    )
    return glyphSource
  }

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData (sourceName: string, interactiveGuide: Uint32Array,
    interactiveData: Uint8Array) {
    // setup variables
    let id, start, end
    const textDecoder = new TextDecoder('utf-8')
    // build interactive guide
    for (let i = 0, gl = interactiveGuide.length; i < gl; i += 3) {
      id = interactiveGuide[i]
      start = interactiveGuide[i + 1]
      end = interactiveGuide[i + 2]
      // parse feature and add properties
      this.interactiveGuide.set(id, JSON.parse(textDecoder.decode(interactiveData.slice(start, end))))
    }
  }

  findInteractiveFeature (id: number) {
    if (this.interactiveGuide.has(id)) return this.interactiveGuide.get(id)
  }
}

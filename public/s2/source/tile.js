// @flow
/* eslint-env browser */
/* global GLenum */
import { Context } from '../gl/contexts'
import buildSource from './buildSource'
import * as mat4 from '../util/mat4'
import { S2Point, bboxST } from 's2projection' // https://github.com/Regia-Corporation/s2projection

import type { Face } from 's2projection' // https://github.com/Regia-Corporation/s2projection/blob/master/src/S2Projection.js#L4
import type { Layer, Mask } from '../style/styleSpec'
import type { ProgramType } from '../gl/programs/program'

export type VectorTileSource = {
  type: 'vector',
  subType: 'fill' | 'line' | 'point' | 'heatmap',
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
  textureID: number,
  height: number,
  glyphFilterVertices: Float32Array,
  glyphQuads: Float32Array,
  filterVAO?: WebGLVertexArrayObject,
  vao?: WebGLVertexArrayObject, // quad vao
  uvBuffer?: WebGLBuffer,
  stepBuffer?: WebGLBuffer,
  glyphFilterBuffer?: WebGLBuffer,
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
  glyphType?: 'text' | 'icon',
  depthPos?: number,
  featureCode: Float32Array,
  subFeatureCode?: Float32Array,
  layerCode: Float32Array,
  mode?: GLenum, // TRIANGLES | TRIANGLE_STRIP | TRIANGLE_FAN | etc
  lch?: boolean
}

// eslint-disable-next-line
export type SourceData = { [string | number]: RasterTileSource | VectorTileSource | GlyphTileSource }

export type Corners = {
  topLeft: S2Point,
  topRight: S2Point,
  bottomLeft: S2Point,
  bottomRight: S2Point
}

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
  corners: Corners
  bottom: Float32Array
  top: Float32Array
  division: number
  sourceData: SourceData = {}
  featureGuide: Array<FeatureGuide> = []
  context: Context
  interactiveGuide: Map<number, Object> = new Map()
  rendered: boolean = false
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
    if (zoom >= 12) this._buildCorners()
    this._getMaskSource()
  }

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete () {
    // remove all features
    this.featureGuide = []
    this.interactiveGuide = new Map()
  }

  deleteSources (sourceNames: Array<string>) {
    for (const sourceName of sourceNames) delete this.sourceData[sourceName]
    this.featureGuide = this.featureGuide.filter(fg => {
      const fgSourceName = fg.sourceName.split(':')[0]
      return !sourceNames.includes(fgSourceName)
    })
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that in the tile property.
  injectParentTile (parent: Tile, layers: Array<Layer>) {
    const bounds = this._buildBounds(parent)
    // feature guides
    for (const feature of parent.featureGuide) {
      const { maxzoom } = layers[feature.layerIndex]
      if (feature.maskLayer) continue // ignore mask features
      if (this.zoom <= maxzoom) this.featureGuide.push({ ...feature, tile: this, parent, bounds })
    }
  }

  // currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
  // the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
  // of what points will be considered
  _buildBounds (parent: Tile) {
    let { x, y, zoom } = this
    const parentZoom = parent.zoom
    // get the scale
    const scale = 1 << (zoom - parentZoom)
    // get x and y shift
    let xShift = 0
    let yShift = 0
    while (zoom > parentZoom) {
      const div = 1 << (zoom - parentZoom)
      if (x % 2 !== 0) xShift += 8192 / div
      if (y % 2 !== 0) yShift += 8192 / div
      // decrement
      x = x >> 1
      y = y >> 1
      zoom--
    }

    // build the bounds bbox
    return [0 + xShift, 0 + yShift, 8192 / scale + xShift, 8192 / scale + yShift]
  }

  _buildCorners () {
    const { face, bbox } = this

    this.corners = {
      topLeft: S2Point.fromSTGL(face, bbox[0], bbox[3]).normalize().mul(6371008.8),
      topRight: S2Point.fromSTGL(face, bbox[2], bbox[3]).normalize().mul(6371008.8),
      bottomLeft: S2Point.fromSTGL(face, bbox[0], bbox[1]).normalize().mul(6371008.8),
      bottomRight: S2Point.fromSTGL(face, bbox[2], bbox[1]).normalize().mul(6371008.8)
    }
    // setup bottom and top
    this.bottom = new Float32Array(4)
    this.top = new Float32Array(4)
  }

  // given a matrix, compute the corners screen positions
  setScreenPositions (projection) {
    if (this.corners) {
      const { eye } = projection
      const [eyeX, eyeY, eyeZ] = eye.map(e => e * 1000)
      const matrix = projection.getMatrix('km')
      // pull out the S2Points
      const { bottomLeft, bottomRight, topLeft, topRight } = this.corners
      // project points and grab their x-y positions
      const [blX, blY] = mat4.project(matrix, [bottomLeft.x - eyeX, bottomLeft.y - eyeY, bottomLeft.z - eyeZ])
      const [brX, brY] = mat4.project(matrix, [bottomRight.x - eyeX, bottomRight.y - eyeY, bottomRight.z - eyeZ])
      const [tlX, tlY] = mat4.project(matrix, [topLeft.x - eyeX, topLeft.y - eyeY, topLeft.z - eyeZ])
      const [trX, trY] = mat4.project(matrix, [topRight.x - eyeX, topRight.y - eyeY, topRight.z - eyeZ])
      // store for eventual uniform "upload"
      this.bottom[0] = blX
      this.bottom[1] = blY
      this.bottom[2] = brX
      this.bottom[3] = brY
      this.top[0] = tlX
      this.top[1] = tlY
      this.top[2] = trX
      this.top[3] = trY
    }
  }

  flush (data) {
    const { source } = data
    // remove "left over" feature guide data from parent injection or old data that wont be replaced in the future
    this.featureGuide = this.featureGuide.filter(fg => {
      const split = fg.sourceName.split(':')
      const fgType = split.pop()
      const fgSource = split.join(':')
      return !(
        fgSource === source &&
        !data[fgType] &&
        fg.parent
      )
    })
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
        source: this.sourceData.mask,
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
      if (this.context.type === 1 && paint) {
        feature.color = (paint.color(null, null, this.zoom)).getRGB()
        feature.opacity = [paint.opacity(null, null, this.zoom)]
      }
      this.featureGuide.push(feature)
    }
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

  injectRasterData (sourceName: string, layerIndexes: Array<number>, image: Image,
    layers: Array<Layer>) {
    const { size } = this
    // prep the source
    let rasterSource = this.sourceData[sourceName]
    // prep phase (should the source not exist)
    if (!rasterSource) {
      rasterSource = this.sourceData[sourceName] = { type: 'raster', size, image }
      buildSource(this.context, rasterSource)
      // store texture information to featureGuide
      for (const layerIndex of layerIndexes) {
        const { depthPos } = layers[layerIndex]
        const guide = {
          tile: this,
          faceST: this.faceST,
          layerIndex,
          depthPos,
          source: this.sourceData.mask,
          sourceName: 'mask',
          subType: 'fill',
          type: 'raster',
          featureCode: [0],
          texture: rasterSource.texture
        }
        this.featureGuide.push(guide)
      }
    }
    // Since a parent may have been injected, we need to remove any instances of the said source data.
    this.featureGuide = this.featureGuide.filter(fg => !(layerIndexes.includes(fg.layerIndex) && fg.parent))
  }

  injectVectorSourceData (sourceName: string, vertexArray: Int16Array, indexArray?: Uint32Array,
    codeTypeArray: Uint8Array, featureGuideArray: Float32Array, layers: Array<Layer>): VectorTileSource {
    // filter parent data if applicable
    this.featureGuide = this.featureGuide.filter(fg => fg.sourceName !== sourceName)
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
        source: vectorSource,
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
        const subFeatureCode = featureCode // default subFeatureCode is for fill which is only color
        const subEncodingSize = featureGuideArray[i]
        i++
        feature.featureCode = new Float32Array(subEncodingSize ? [...featureGuideArray.slice(i, i + subEncodingSize)] : [0])
        i += subEncodingSize
        if (subType === 'fill') {
          feature.color = []
          feature.opacity = []
          const len = subFeatureCode.length / 5
          for (let s = 0; s < len; s++) {
            const idx = s * 5
            feature.color.push(...subFeatureCode.slice(idx, idx + 4))
            feature.opacity.push(subFeatureCode[idx + 4])
          }
        } else if (subType === 'line') {
          feature.color = subFeatureCode.slice(0, 4)
          feature.width = subFeatureCode[4]
        } else if (subType === 'point') {
          feature.color = subFeatureCode.slice(0, 4)
          feature.radius = subFeatureCode[4]
          feature.stroke = subFeatureCode.slice(5, 9)
          feature.strokeWidth = subFeatureCode[9]
          feature.opacity = subFeatureCode[10]
        } else if (subType === 'heatmap') {
          feature.intensity = subFeatureCode[0]
          feature.radius = subFeatureCode[1]
          feature.opacity = subFeatureCode[2]
        }
      }
      // store
      this.featureGuide.push(feature)
    }
    // build the VAO
    buildSource(this.context, vectorSource)
  }

  injectGlyphSourceData (sourceName: string, glyphFilterVertices: Float32Array,
    glyphQuads: Float32Array, glyphColors: Uint8ClampedArray,
    featureGuideBuffer: Float32Array, layers: Array<Layer>) {
    // filter parent data if applicable
    this.featureGuide = this.featureGuide.filter(fg => fg.sourceName !== sourceName)
    const { context } = this
    const glyphSource = this.sourceData[sourceName] = {
      type: 'glyph',
      glyphFilterVertices,
      glyphQuads,
      glyphColors
    }
    // LayerCode: layerIndex, offset, count, codeLength, code
    // we work off the featureGuideBuffer, adding to the buffer as we go
    const lgl = featureGuideBuffer.length
    let i = 0
    while (i < lgl) {
      // grab the size, layerIndex, count, and offset, and update the index
      const [layerIndex, type, filterOffset, filterCount, offset, count, encodingSize] = featureGuideBuffer.slice(i, i + 7)
      i += 7
      // grab the layers type and code
      if (!layers[layerIndex]) console.log(layerIndex, featureGuideBuffer)
      const { overdraw, depthPos, code, iconCode, lch, interactive } = layers[layerIndex]
      // create and store the featureGuide
      const feature = {
        tile: this,
        faceST: this.faceST,
        layerIndex,
        source: glyphSource,
        sourceName,
        filterOffset,
        filterCount,
        offset,
        count,
        type: 'glyph',
        glyphType: type === 0 ? 'text' : 'icon',
        depthPos,
        featureCode: new Float32Array(encodingSize ? [...featureGuideBuffer.slice(i, i + encodingSize)] : [0]),
        layerCode: type === 0 ? code : iconCode,
        interactive,
        overdraw,
        lch
      }
      i += encodingSize
      // if WebGL1 - we also have to grab the fill, stroke, and strokeWidth
      if (context.type === 1) {
        if (type === 0) { // text
          // get fill, stroke, and stroke width. Increment
          feature.size = featureGuideBuffer[i]
          feature.fill = featureGuideBuffer.slice(i + 1, i + 5)
          feature.stroke = featureGuideBuffer.slice(i + 5, i + 9)
          feature.strokeWidth = featureGuideBuffer[i + 9]
          i += 10
        } else { // icon
          feature.size = featureGuideBuffer[i]
          i++
        }
      }
      // store feature
      this.featureGuide.push(feature)
    }

    // build the VAO
    buildSource(context, glyphSource)
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

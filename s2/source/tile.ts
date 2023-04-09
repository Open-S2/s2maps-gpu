/* eslint-env browser */
import { project } from 's2/ui/camera/projector/mat4'
import { bboxST } from 's2/geometry/s2/s2Coords'
import { fromSTGL, mul, normalize } from 's2/geometry/s2/s2Point'
import { level, toIJ } from 's2/geometry/s2/s2CellID'

import type { FeatureGuide as FeatureGuideGL, MaskSource as MaskSourceGL, WebGL2Context, WebGLContext } from 's2/gl/contexts'
import type Projector from 's2/ui/camera/projector'
import type { Face, XYZ } from 's2/geometry'
import type { FlushData, InteractiveObject } from 's2/workers/worker.spec'
import type { LayerDefinition } from 's2/style/style.spec'
import type { FeatureGuide as FeatureGuideGPU, MaskSource as MaskSourceGPU, WebGPUContext } from 's2/gpu/context'
import type { Corners, TileGL, TileGPU } from './tile.spec'

// tiles are designed to create mask geometry and store prebuilt layer data handed off by the worker pool
// whenever rerenders are called, they will access these tile objects for the layer data / vaos
// before managing sources asyncronously, a tile needs to synchronously build spherical background
// data to ensure we get no awkward visuals.
export default class Tile {
  id: bigint
  face: Face
  i: number
  j: number
  zoom: number
  size: number
  tmpMaskID = 0
  mask: MaskSourceGL | MaskSourceGPU
  bbox: [number, number, number, number]
  faceST: [number, number, number, number, number, number]
  corners?: Corners
  bottom: [number, number, number, number] = [0, 0, 0, 0]
  top: [number, number, number, number] = [0, 0, 0, 0]
  division = 16
  featureGuides: Array<FeatureGuideGL | FeatureGuideGPU> = []
  context: WebGLContext | WebGL2Context | WebGPUContext
  interactiveGuide: Map<number, InteractiveObject> = new Map()
  rendered = false
  constructor (
    context: WebGLContext | WebGL2Context | WebGPUContext,
    id: bigint,
    size = 512
  ) {
    const zoom = this.zoom = level(id)
    const [face, i, j] = toIJ(id, zoom)
    this.context = context
    this.id = id
    this.face = face
    this.i = i
    this.j = j
    this.size = size
    const bbox = this.bbox = bboxST(i, j, zoom)
    this.faceST = [face, zoom, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]]
    if (zoom >= 12) this.#buildCorners()
    // build division
    this.division = 16 / (1 << Math.max(Math.min(Math.floor(zoom / 2), 4), 0))
    // grab mask
    this.mask = context.getMask(this.division)
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that in the tile property.
  injectParentTile (parent: TileGL & TileGPU, layers: LayerDefinition[]): void {
    // feature guides
    for (const feature of parent.featureGuides) {
      if ('maskLayer' in feature && feature.maskLayer) continue // ignore mask features
      const { maxzoom } = layers[feature.layerIndex]
      const actualParent = feature.parent ?? parent
      if (this.zoom <= maxzoom) {
        this.featureGuides.push({
          ...feature,
          tile: this as unknown as TileGL & TileGPU,
          parent: actualParent,
          bounds: this.#buildBounds(actualParent)
        })
      }
    }
    // interactive guides
    for (const [id, interactive] of parent.interactiveGuide) this.interactiveGuide.set(id, interactive)
  }

  // currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
  // the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
  // of what points will be considered
  #buildBounds (parent: TileGL | TileGPU): [number, number, number, number] {
    let { i, j, zoom } = this
    const parentZoom = parent.zoom
    // get the scale
    const scale = 1 << (zoom - parentZoom)
    // get i and j shift
    let iShift = 0
    let jShift = 0
    while (zoom > parentZoom) {
      const div = 1 << (zoom - parentZoom)
      if (i % 2 !== 0) iShift += 8_192 / div
      if (j % 2 !== 0) jShift += 8_192 / div
      // decrement
      i = i >> 1
      j = j >> 1
      zoom--
    }

    // build the bounds bbox
    return [0 + iShift, 0 + jShift, 8_192 / scale + iShift, 8_192 / scale + jShift]
  }

  #buildCorners (): void {
    const { face, bbox } = this

    this.corners = {
      topLeft: mul(normalize(fromSTGL(face, bbox[0], bbox[3])), 6371008.8),
      topRight: mul(normalize(fromSTGL(face, bbox[2], bbox[3])), 6371008.8),
      bottomLeft: mul(normalize(fromSTGL(face, bbox[0], bbox[1])), 6371008.8),
      bottomRight: mul(normalize(fromSTGL(face, bbox[2], bbox[1])), 6371008.8)
    }
  }

  // given a matrix, compute the corners screen positions
  setScreenPositions (projector: Projector): void {
    if (this.corners !== undefined) {
      const { eye } = projector
      const eyeKM = eye.map(e => e * 1000)
      const matrix = projector.getMatrix('km')
      // pull out the S2Points
      const { bottomLeft, bottomRight, topLeft, topRight } = this.corners
      // project points and grab their x-y positions
      const [blX, blY] = project(matrix, bottomLeft.map((n, i) => n - eyeKM[i]) as XYZ)
      const [brX, brY] = project(matrix, bottomRight.map((n, i) => n - eyeKM[i]) as XYZ)
      const [tlX, tlY] = project(matrix, topLeft.map((n, i) => n - eyeKM[i]) as XYZ)
      const [trX, trY] = project(matrix, topRight.map((n, i) => n - eyeKM[i]) as XYZ)
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

  addFeatures (features: Array<FeatureGuideGL | FeatureGuideGPU>): void {
    // filter parent tiles that were added
    const layerIndexes = new Set(features.map(f => f.layerIndex))
    this.featureGuides = this.featureGuides.filter(f => !(
      f.parent !== undefined &&
      layerIndexes.has(f.layerIndex)
    ))
    // add features
    this.featureGuides.push(...features)
  }

  flush (data: FlushData): void {
    const { layers } = data
    // otherwise remove "left over" feature guide data from parent injection
    // or old data that wont be replaced in the future
    // NOTE: Eventually the count will be used to know what features need to be tracked (before screenshots for instance)
    const deadLayers: number[] = []
    for (const [id, count] of Object.entries(layers)) if (count === 0) deadLayers.push(+id)
    this.featureGuides = this.featureGuides.filter(fg => {
      return !(
        deadLayers.includes(fg.layerIndex) &&
        fg.parent !== undefined &&
        // corner-case: empty data/missing tile -> flushes ALL layers,
        // but that layer MAY BE inverted so we don't kill it.
        !('invert' in fg && fg.invert)
      )
    })
  }

  removeLayer (index: number): void {
    // remove any references to layerIndex
    this.featureGuides = this.featureGuides.filter(f => f.layerIndex !== index)
    // all layerIndexes greater than index should be decremented once
    for (const feature of this.featureGuides) {
      feature.layerIndex--
    }
  }

  reorderLayers (layerChanges: { [key: number]: number }): void {
    for (const feature of this.featureGuides) {
      feature.layerIndex = layerChanges[feature.layerIndex]
    }
  }

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData (
    interactiveGuide: Uint32Array,
    interactiveData: Uint8Array
  ): void {
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

  getInteractiveFeature (id: number): undefined | InteractiveObject {
    return this.interactiveGuide.get(id)
  }

  // cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache.
  delete (): void {
    // remove all features
    this.featureGuides = []
    this.interactiveGuide = new Map()
  }

  deleteSources (sourceNames: string[]): void {
    this.featureGuides = this.featureGuides.filter(fg => {
      const fgSourceName = fg.sourceName.split(':')[0]
      return !sourceNames.includes(fgSourceName)
    })
  }
}

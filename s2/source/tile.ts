/* eslint-env browser */
import { project } from 'ui/camera/projector/mat4'
import { bboxST } from 'geometry/s2/s2Coords'
import { fromID, llToTilePx } from 'geometry/webMerc'
import { fromSTGL, mul, normalize } from 'geometry/s2/s2Point'
import { level, toIJ } from 'geometry/s2/s2CellID'

import type {
  Context as ContextGL,
  FeatureGuide as FeatureGuideGL,
  MaskSource as MaskSourceGL
} from 'gl/contexts/context.spec'
import type WebGPUContext from 'gpu/context/context'
import type {
  FeatureBase as FeatureBaseGPU,
  MaskSource as MaskSourceGPU
} from 'gpu/workflows/workflow.spec'
import type Projector from 'ui/camera/projector'
import type { BBox, Face, XYZ } from 'geometry'
import type { FlushData, InteractiveObject } from 'workers/worker.spec'
import type { LayerDefinition, Projection } from 'style/style.spec'
import type {
  Bottom,
  Corners,
  FaceST,
  S2Tile as S2TileSpec,
  TileBase,
  Top,
  WMTile as WMTileSpec
} from './tile.spec'

export function createTile (
  projection: Projection,
  context: ContextGL | WebGPUContext,
  id: bigint,
  size = 512
): S2Tile | WMTile {
  if (projection === 'S2') return new S2Tile(context, id, size)
  else return new WMTile(context, id, size)
}

class Tile implements TileBase {
  id: bigint
  face: Face = 0
  i = 0
  j = 0
  zoom = 0
  size: number
  division = 1
  tmpMaskID = 0
  mask: MaskSourceGL | MaskSourceGPU
  bbox: BBox = [0, 0, 0, 0]
  featureGuides: Array<FeatureGuideGL | FeatureBaseGPU> = []
  context: ContextGL | WebGPUContext
  interactiveGuide = new Map<number, InteractiveObject>()
  rendered = false
  uniforms: Float32Array = new Float32Array(16) // [padding, isS2, face, zoom, sLow, tLow, deltaS, deltaT, ...bottom, ...top]
  constructor (
    context: ContextGL | WebGPUContext,
    id: bigint,
    size = 512
  ) {
    this.context = context
    this.id = id
    this.size = size
    // grab mask
    this.mask = context.getMask(1)
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that in the tile property.
  injectParentTile (parent: Tile, layers: LayerDefinition[]): void {
    // feature guides
    for (const feature of parent.featureGuides) {
      if ('maskLayer' in feature && feature.maskLayer) continue // ignore mask features
      const { maxzoom } = layers[feature.layerIndex]
      const actualParent = feature.parent ?? parent
      if (this.zoom <= maxzoom) {
        this.featureGuides.push({
          ...feature,
          tile: this as any, // TODO: Maybe TS actually has a sane way to solve this problem.
          parent: actualParent as any,
          bounds: this.#buildBounds(actualParent as any)
        })
      }
    }
    // interactive guides
    for (const [id, interactive] of parent.interactiveGuide) this.interactiveGuide.set(id, interactive)
  }

  // currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
  // the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
  // of what points will be considered
  #buildBounds (parent: S2Tile): [number, number, number, number] {
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

  addFeatures (features: Array<FeatureGuideGL | FeatureBaseGPU>): void {
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

  reorderLayers (layerChanges: Record<number, number>): void {
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

export class S2Tile extends Tile implements S2TileSpec {
  type = 'S2' as const
  faceST: FaceST
  corners?: Corners
  bottom: Bottom = [0, 0, 0, 0]
  top: Top = [0, 0, 0, 0]
  constructor (
    context: ContextGL | WebGPUContext,
    id: bigint,
    size = 512
  ) {
    super(context, id, size)
    const { max, min, floor } = Math
    const zoom = this.zoom = level(id)
    const [face, i, j] = toIJ(id, zoom)
    this.face = face
    this.i = i
    this.j = j
    const bbox = this.bbox = bboxST(i, j, zoom)
    this.faceST = [face, zoom, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]]
    if (zoom >= 12) this.#buildCorners()
    // build division
    this.division = 16 / (1 << max(min(floor(zoom / 2), 4), 0))
    // grab mask
    if (this.division !== 1) this.mask = context.getMask(this.division)
    // setup uniforms
    this.uniforms = new Float32Array([
      0, // padding
      1, // isS2
      face,
      zoom,
      bbox[0],
      bbox[1],
      bbox[2] - bbox[0],
      bbox[3] - bbox[1],
      ...this.bottom,
      ...this.top
    ])
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
      this.uniforms[8] = this.bottom[0] = blX
      this.uniforms[9] = this.bottom[1] = blY
      this.uniforms[10] = this.bottom[2] = brX
      this.uniforms[11] = this.bottom[3] = brY
      this.uniforms[12] = this.top[0] = tlX
      this.uniforms[13] = this.top[1] = tlY
      this.uniforms[14] = this.top[2] = trX
      this.uniforms[15] = this.top[3] = trY
    }
  }
}

export class WMTile extends Tile implements WMTileSpec {
  type = 'WM' as const
  matrix: Float32Array = new Float32Array(16)
  constructor (
    context: ContextGL | WebGPUContext,
    id: bigint,
    size = 512
  ) {
    super(context, id, size)
    const [zoom, i, j] = fromID(id)
    this.i = i
    this.j = j
    this.zoom = zoom
    // setup uniforms
    this.uniforms = new Float32Array([
      0, // padding
      0, // isS2
      0,
      zoom
    ])
  }

  // given a basic ortho matrix, adjust by the tile's offset and scale
  setScreenPositions (projector: Projector): void {
    const { zoom, lon, lat } = projector
    const scale = Math.pow(2, zoom - this.zoom)
    const offset = llToTilePx([lon, lat], [this.zoom, this.i, this.j])

    this.matrix = projector.getMatrix(scale, offset)
  }
}

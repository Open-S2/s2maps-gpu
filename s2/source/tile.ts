import { project } from 'ui/camera/projector/mat4'
import { bboxST } from 'geometry/s2/s2Coords'
import { fromID, llToTilePx } from 'geometry/wm'
import { fromSTGL, mul, normalize } from 'geometry/s2/s2Point'
import { level, toIJ } from 'geometry/s2/s2CellID'

import type Projector from 'ui/camera/projector'
import type { BBox, Face, XYZ } from 'geometry'
import type { InteractiveObject, SourceFlushMessage, TileFlushMessage } from 'workers/worker.spec'
import type { LayerDefinition, Projection } from 'style/style.spec'
import type {
  Corners,
  FaceST,
  SharedContext,
  SharedFeatureGuide,
  SharedMaskSource,
  TileGL,
  TileGPU,
  TileBase as TileSpec
} from './tile.spec'
import type { WebGPUContext } from 'gpu/context'
import type { WebGL2Context, WebGLContext } from 'gl'

export function createTile (
  projection: Projection,
  context: WebGPUContext | WebGLContext | WebGL2Context,
  id: bigint
): TileGL & TileGPU {
  const Tile = projection === 'S2' ? S2Tile : WMTile
  return new Tile(context as unknown as SharedContext, id) as unknown as TileGL & TileGPU
}

class Tile<C extends SharedContext, F extends SharedFeatureGuide, M extends SharedMaskSource>
implements TileSpec<C, F, M> {
  id: bigint
  face: Face = 0
  i = 0
  j = 0
  zoom = 0
  division = 1
  tmpMaskID = 0
  mask!: M
  bbox: BBox = [0, 0, 0, 0]
  featureGuides: F[] = []
  context: C
  interactiveGuide = new Map<number, InteractiveObject>()
  uniforms = new Float32Array(7) // [isS2, face, zoom, sLow, tLow, deltaS, deltaT]
  bottomTop = new Float32Array(8)
  state: 'loading' | 'loaded' | 'deleted' = 'loading'
  type: 'S2' | 'WM' = 'S2'
  faceST!: FaceST
  matrix!: Float32Array
  layersLoaded = new Set<number>()
  layersToBeLoaded?: Set<number>
  constructor (context: C, id: bigint) {
    this.context = context
    this.id = id
  }

  // inject references to featureGuide from each parentTile. Sometimes if we zoom really fast, we inject
  // a parents' parent or deeper, so we need to reflect that in the tile property.
  injectParentTile (parent: TileSpec<C, F, M>, layers: LayerDefinition[]): void {
    // feature guides
    for (const feature of parent.featureGuides) {
      if (feature.maskLayer ?? false) continue // ignore mask features
      const { maxzoom } = layers[feature.layerGuide.layerIndex]
      const actualParent = feature.parent ?? parent
      if (this.zoom <= maxzoom) {
        const bounds = this.#buildBounds(actualParent)
        if (feature.duplicate !== undefined) {
          // @ts-expect-error - there is no easy way to solve this typescript error
          this.featureGuides.push(feature.duplicate(this, actualParent, bounds))
        } else {
          this.featureGuides.push({
            ...feature,
            tile: this,
            parent: actualParent,
            bounds
          })
        }
      }
    }
    // interactive guides
    for (const [id, interactive] of parent.interactiveGuide) this.interactiveGuide.set(id, interactive)
  }

  setScreenPositions (_: Projector): void {
    const { context, mask, bottomTop } = this
    // if WebGPU mask, we need to update the position buffer
    if (mask.positionBuffer !== undefined) {
      context.device?.queue.writeBuffer(mask.positionBuffer, 0, bottomTop)
    }
  }

  /**
   * currently this is for glyphs, points, and heatmaps. By sharing glyph data with children,
   * the glyphs will be rendered 4 or even more times. To alleviate this, we can set boundaries
   * of what points will be considered
   */
  #buildBounds (parent: TileSpec<C, F, M>): BBox {
    let { i, j, zoom } = this
    const parentZoom = parent.zoom
    // get the scale
    const scale = 1 << (zoom - parentZoom)
    // get i and j shift
    let iShift = 0
    let jShift = 0
    while (zoom > parentZoom) {
      const div = 1 << (zoom - parentZoom)
      if (i % 2 !== 0) iShift += 1 / div
      if (j % 2 !== 0) jShift += 1 / div
      // decrement
      i = i >> 1
      j = j >> 1
      zoom--
    }

    // build the bounds bbox
    return [0 + iShift, 0 + jShift, 1 / scale + iShift, 1 / scale + jShift]
  }

  addFeatures (features: F[]): void {
    const { layersLoaded } = this
    // filter parent tiles that were added
    const layerIndexes = new Set<number>(features.map(f => f.layerGuide.layerIndex))
    this.featureGuides = this.featureGuides.filter(f => !(
      f.parent !== undefined &&
      layerIndexes.has(f.layerGuide.layerIndex)
    ))
    // add features
    this.featureGuides.push(...features)
    // clear from sourceCheck then check if all sources are loaded
    for (const layerIndex of layerIndexes) layersLoaded.add(layerIndex)

    this.#checkState()
  }

  flush (msg: SourceFlushMessage | TileFlushMessage): void {
    if (msg.from === 'source') this.#sourceFlush({ ...msg })
    else this.#tileFlush({ ...msg })
    this.#checkState()
  }

  // the source let's us know what data to expect
  #sourceFlush ({ layersToBeLoaded }: SourceFlushMessage): void {
    this.layersToBeLoaded = layersToBeLoaded
  }

  #tileFlush (msg: TileFlushMessage): void {
    const { layersLoaded } = this
    const { deadLayers } = msg
    // otherwise remove "left over" feature guide data from parent injection
    // or old data that wont be replaced in the future
    // NOTE: Eventually the count will be used to know what features need to be tracked (before screenshots for instance)
    this.featureGuides = this.featureGuides.filter(fg => {
      return !(
        deadLayers.includes(fg.layerGuide.layerIndex) &&
        fg.parent !== undefined &&
        // corner-case: empty data/missing tile -> flushes ALL layers,
        // but that layer MAY BE inverted so we don't kill it.
        !(fg.invert ?? false)
      )
    })
    // remove dead layers from layersToBeLoaded
    for (const deadLayer of deadLayers) layersLoaded.add(deadLayer)
  }

  #checkState (): void {
    const { layersLoaded, layersToBeLoaded } = this
    if (this.state === 'deleted' || layersToBeLoaded === undefined) return
    // if all layers are loaded, set state to loaded
    if (setBContainsA(layersToBeLoaded, layersLoaded)) this.state = 'loaded'
  }

  removeLayer (index: number): void {
    // remove any references to layerIndex
    this.featureGuides = this.featureGuides.filter(f => f.layerGuide.layerIndex !== index)
    // all layerIndexes greater than index should be decremented once
    for (const { layerGuide } of this.featureGuides) {
      if (layerGuide.layerIndex > index) layerGuide.layerIndex--
    }
  }

  reorderLayers (layerChanges: Record<number, number>): void {
    for (const { layerGuide } of this.featureGuides) {
      const change = layerChanges[layerGuide.layerIndex]
      if (change !== undefined) layerGuide.layerIndex = change
    }
  }

  // we don't parse the interactiveData immediately to save time
  injectInteractiveData (
    interactiveGuide: Uint32Array,
    interactiveData: Uint8Array
  ): void {
    // setup variables
    let id: number, start: number, end: number
    const textDecoder = new TextDecoder('utf-8')
    // build interactive guide
    for (let i = 0, gl = interactiveGuide.length; i < gl; i += 3) {
      id = interactiveGuide[i]
      start = interactiveGuide[i + 1]
      end = interactiveGuide[i + 2]
      // parse feature and add properties
      const interactiveObject: InteractiveObject = JSON.parse(textDecoder.decode(interactiveData.slice(start, end)))
      this.interactiveGuide.set(id, interactiveObject)
    }
  }

  getInteractiveFeature (id: number): undefined | InteractiveObject {
    return this.interactiveGuide.get(id)
  }

  /** cleanup after itself. When a tile is deleted, it's adventageous to cleanup GPU cache. */
  delete (): void {
    this.state = 'deleted'
    // remove all features
    for (const feature of this.featureGuides) feature.destroy?.()
    this.featureGuides = []
    this.interactiveGuide = new Map()
    this.mask.destroy?.()
  }

  /** remove all sources that match the input sourceNames */
  deleteSources (sourceNames: string[]): void {
    this.featureGuides = this.featureGuides.filter(fg => {
      const fgSourceName = fg.sourceName.split(':')[0]
      const keep = !sourceNames.includes(fgSourceName)
      // GPU case: destroy any/all buffers that are no longer needed
      if (!keep) fg.destroy?.()
      return keep
    })
  }
}

export class S2Tile<C extends SharedContext, F extends SharedFeatureGuide, M extends SharedMaskSource>
  extends Tile<C, F, M> {
  type = 'S2' as const
  corners?: Corners
  constructor (context: C, id: bigint) {
    super(context, id)
    const { max, min, floor } = Math
    const zoom = this.zoom = level(id)
    const [face, i, j] = toIJ(id, zoom)
    this.face = face
    this.i = i
    this.j = j
    const bbox = this.bbox = bboxST(i, j, zoom)
    this.faceST = [face, zoom, bbox[2] - bbox[0], bbox[0], bbox[3] - bbox[1], bbox[1]]
    if (zoom >= 12) this.#buildCorners()
    // setup uniforms
    this.uniforms = new Float32Array([
      1, // isS2
      face,
      zoom,
      bbox[0], // sLow
      bbox[1], // tLow
      bbox[2] - bbox[0], // deltaS
      bbox[3] - bbox[1] // deltaT
    ])
    // build division
    this.division = 16 / (1 << max(min(floor(zoom / 2), 4), 0))
    // grab mask
    this.mask = context.getMask(this.division, this as never) as M
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
      this.bottomTop[0] = blX
      this.bottomTop[1] = blY
      this.bottomTop[2] = brX
      this.bottomTop[3] = brY
      this.bottomTop[4] = tlX
      this.bottomTop[5] = tlY
      this.bottomTop[6] = trX
      this.bottomTop[7] = trY
      // if WebGPU mask, we need to update the position buffer
      super.setScreenPositions(projector)
    }
  }
}

export class WMTile<C extends SharedContext, F extends SharedFeatureGuide, M extends SharedMaskSource>
  extends Tile<C, F, M> {
  type = 'WM' as const
  matrix = new Float32Array(16)
  constructor (context: C, id: bigint) {
    super(context, id)
    const [zoom, i, j] = fromID(id)
    this.i = i
    this.j = j
    this.zoom = zoom
    // TODO: bboxWM? And do I apply it to the uniforms?
    // const bbox = this.bbox = bboxST(i, j, zoom)
    this.bbox = bboxST(i, j, zoom)
    // setup uniforms
    this.uniforms = new Float32Array([
      0, // isS2
      0, // face
      zoom, // zoom
      // padding (unused by WM tiles)
      0, // sLow
      0, // tLow
      1, // deltaS
      1 // deltaT
    ])
    // grab mask
    this.mask = context.getMask(1, this as never) as M
  }

  // given a basic ortho matrix, adjust by the tile's offset and scale
  setScreenPositions (projector: Projector): void {
    const { zoom, lon, lat } = projector
    const scale = Math.pow(2, zoom - this.zoom)
    const offset = llToTilePx([lon, lat], [this.zoom, this.i, this.j], 1)

    this.matrix = projector.getMatrix(scale, offset)

    // build bottomTop
    const { matrix } = this
    const bl = project(matrix, [0, 0, 0])
    const br = project(matrix, [1, 0, 0])
    const tl = project(matrix, [0, 1, 0])
    const tr = project(matrix, [1, 1, 0])
    // store for eventual uniform "upload"
    this.bottomTop[0] = bl[0]
    this.bottomTop[1] = bl[1]
    this.bottomTop[2] = br[0]
    this.bottomTop[3] = br[1]
    this.bottomTop[4] = tl[0]
    this.bottomTop[5] = tl[1]
    this.bottomTop[6] = tr[0]
    this.bottomTop[7] = tr[1]

    super.setScreenPositions(projector)
  }
}

function setBContainsA (setA: Set<number>, set2: Set<number>): boolean {
  for (const item of setA) if (!set2.has(item)) return false
  return true
}

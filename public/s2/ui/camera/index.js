// @flow
/* eslint-env browser */
/** STYLE **/
import Style from '../../style'
/** PAINT **/
import type { Painter } from '../../gl'
import type { MapOptions } from '../map'
/** PROJECTIONS **/
import { parent as parentID, isFace } from '../../geo/S2CellID'
import Projector from './projector'
/** SOURCES **/
import { Tile } from '../../source'
import TileCache from './tileCache'

import type { TileDefinitions } from './projector'

// eslint-disable-next-line no-unused-vars
declare class Timeout extends Number {
  +ref?: () => this;
  +unref?: () => this;
}
declare function SetTimeout (fn: Function, ms?: number): Timeout;

export default class Camera {
  style: Style
  painter: Painter
  projector: Projector
  tileCache: TileCache
  tilesInView: Array<Tile> = [] // S2CellIDs of the tiles
  lastTileViewState: Array<number> = []
  requestQueue: Array<Tile> = []
  zooming: void | SetTimeout
  request: void | SetTimeout
  _updateWhileZooming: boolean // this is a more cpu/gpu intensive redraw technique that will update tiles while the user is still zooming. This can cause overdrawing if the user is going to zoom from say 0 to 10 quickly.
  wasDirtyLastFrame: boolean = false
  constructor (options: MapOptions) {
    this._updateWhileZooming = options.updateWhileZooming || true
    // setup projector
    this.projector = new Projector(options)
    // prep the tileCache for future tiles
    this.tileCache = new TileCache()
  }

  _resizeCamera (width: number, height: number) {
    // ensure minimum is 1px for both
    width = Math.max(width, 1)
    height = Math.max(height, 1)
    // update the projector and painter
    this.projector.resize(width, height)
    if (this.painter) this.painter.resize()
  }

  _injectData (data) {
    const { type } = data
    if (type === 'filldata' || type === 'linedata' || type === 'pointdata') this._injectVectorSourceData(data.source, data.tileID, data.vertexBuffer, data.indexBuffer, data.codeTypeBuffer, data.featureGuideBuffer)
    else if (type === 'heatmapdata') this._injectVectorSourceData(data.source, data.tileID, data.vertexBuffer, data.weightBuffer, data.codeTypeBuffer, data.featureGuideBuffer, true)
    else if (type === 'maskdata') this._injectMaskGeometry(data.tileID, data.vertexBuffer, data.indexBuffer, data.radiiBuffer)
    else if (type === 'rasterdata') this._injectRasterData(data.source, data.tileID, data.built, data.image)
    else if (type === 'glyphdata') this._injectGlyphSourceData(data.source, data.tileID, data.glyphFilterBuffer, data.glyphQuadBuffer, data.glyphColorBuffer, data.featureGuideBuffer)
    else if (type === 'glyphimages') this.painter.injectGlyphImages(data.maxHeight, data.images)
    else if (type === 'interactivedata') this._injectInteractiveData(data.source, data.tileID, data.interactiveGuideBuffer, data.interactiveDataBuffer)
    else if (type === 'flush') this._injectFlush(data)
    // new 'paint', so painter is dirty
    this.painter.dirty = true
  }

  _injectFlush (data) {
    const { tileID } = data
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.flush(data)
    }
  }

  _injectMaskGeometry (tileID: number, vertexBuffer: ArrayBuffer,
    indexBuffer: ArrayBuffer, radiiBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectMaskGeometry(new Int16Array(vertexBuffer), new Uint32Array(indexBuffer), new Float32Array(radiiBuffer), this.style.mask)
    }
  }

  _injectVectorSourceData (source: string, tileID: number, vertexBuffer: ArrayBuffer,
    indexWeightBuffer: ArrayBuffer, codeTypeBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer,
    weight?: boolean = false) {
    if (this.tileCache.has(tileID)) {
      // get tile
      const tile = this.tileCache.get(tileID)
      // inject into tile
      tile.injectVectorSourceData(source, new Int16Array(vertexBuffer), (weight) ? new Float32Array(indexWeightBuffer) : new Uint32Array(indexWeightBuffer), codeTypeBuffer ? new Uint8Array(codeTypeBuffer) : null, new Float32Array(featureGuideBuffer), this.style.layers)
    }
  }

  _injectRasterData (source: string, tileID: number, built: boolean, image: ImageBitmap | ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      // get tile
      const tile = this.tileCache.get(tileID)
      // find all layers that utilize the raster data
      const layerIndexs = this.style.layers.filter(layer => layer.source === source).map(layer => layer.layerIndex)
      // inject into tile
      if (!built) {
        createImageBitmap(new Blob([image]))
          .then(image => tile.injectRasterData(source, layerIndexs, image, this.style.layers))
      } else { tile.injectRasterData(source, layerIndexs, image, this.style.layers) }
    }
  }

  _injectGlyphSourceData (source: string, tileID: number, glyphFilterBuffer: ArrayBuffer,
    glyphQuadBuffer: ArrayBuffer, glyphColorBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    // store the vertexBuffer and texture in the gpu.
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectGlyphSourceData(
        source, new Float32Array(glyphFilterBuffer), new Float32Array(glyphQuadBuffer),
        new Uint8ClampedArray(glyphColorBuffer), new Float32Array(featureGuideBuffer),
        this.style.layers
      )
    }
  }

  _injectInteractiveData (source: string, tileID: number, interactiveGuideBuffer: ArrayBuffer,
    interactiveDataBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectInteractiveData(source, new Uint32Array(interactiveGuideBuffer), new Uint8Array(interactiveDataBuffer))
    }
  }

  _getTiles (): Array<Tile> {
    if (this.projector.dirty) {
      let tilesInView: TileDefinitions = []
      // no matter what we need to update what's in view
      const newTiles = []
      // update tiles in view
      tilesInView = this.projector.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const id of tilesInView) {
        if (!this.tileCache.has(id)) {
          // tile not found, so we create it
          const newTile = this._createTile(id)
          // store reference for the style to request from webworker(s)
          newTiles.push(newTile)
        }
      }
      // if new tiles exist, ensture the worker and painter are updated
      if (newTiles.length) {
        this.painter.dirty = true
        this.style.requestTiles(newTiles)
      }
      // given the S2CellID, find them in cache and return them
      this.tilesInView = this.tileCache.getBatch(tilesInView)

      return this.tilesInView
    } else { return this.tilesInView }
  }

  _createTile (id: BigInt): Tile {
    const { style } = this
    // create tile
    const tile = new Tile(this.painter.context, id)
    // should our style have default layers, let's add them
    if (style.maskLayers.length) tile.injectMaskLayers(style.maskLayers)
    // inject parent should one exist
    if (!isFace(id)) {
      // get closest parent S2CellID. If actively zooming, the parent tile will pass along
      // it's parent tile (and so forth) if its own data has not been processed yet.
      const pID = parentID(id)
      // check if parent tile exists, if so inject
      if (this.tileCache.has(pID)) {
        const parent = this.tileCache.get(pID)
        tile.injectParentTile(parent, this.style.layers)
      }
    }
    // store the tile
    this.tileCache.set(id, tile)

    return tile
  }

  _fullyRenderedScreen (): boolean {
    const tiles = this._getTiles()
    let fullyRendered = true
    for (const tile of tiles) {
      if (tile.rendered !== true) {
        fullyRendered = false
        break
      }
    }
    return fullyRendered
  }

  /* DRAW */

  _draw () {
    const { style, painter, projector } = this
    // prep tiles
    const tiles = this._getTiles()
    // if any changes, we paint new scene
    if (style.dirty || painter.dirty || projector.dirty) {
      // store for future draw that it was a "dirty" frame
      this.wasDirtyLastFrame = true
      // paint scene
      painter.paint(projector, style, tiles)
    }
    // draw the interactive elements if there was no movement/zoom change
    if (style.interactive && !projector.dirty && this.wasDirtyLastFrame) {
      this.wasDirtyLastFrame = false
      painter.paintInteractive(tiles)
    }
    // cleanup
    painter.dirty = false
    style.dirty = false
    projector.dirty = false
  }
}

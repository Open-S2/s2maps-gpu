// @flow
/* eslint-env browser */
/** STYLE **/
import Style from '../../style'
/** PAINT **/
import type { Painter } from '../../gl'
import type { MapOptions } from '../map'
/** PROJECTIONS **/
import { parent as parentID, isFace } from 's2projection/s2CellID'
import Projector from './projector'
/** SOURCES **/
import { Tile } from '../../source'
import TileCache from './tileCache'
import TimeCache from './timeCache'

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
  tileCache: TileCache = new TileCache()
  timeCache: TimeCache
  tilesInView: Array<Tile> = [] // S2CellIDs of the tiles
  lastTileViewState: Array<number> = []
  requestQueue: Array<Tile> = []
  zooming: void | SetTimeout
  request: void | SetTimeout
  wasDirtyLastFrame: boolean = false
  webworker: boolean = false
  constructor (options: MapOptions) {
    // setup projector
    this.projector = new Projector(options, this)
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
    if (type === 'fill' || type === 'line' || type === 'point' || type === 'heatmap') this._injectVectorSourceData(data.sourceName, data.tileID, data.vertexBuffer, data.indexBuffer || data.weightBuffer, data.fillIDBuffer, data.codeTypeBuffer, data.featureGuideBuffer, type === 'heatmap')
    else if (type === 'mask') this._injectMaskGeometry(data.tileID, data.vertexBuffer, data.indexBuffer, data.radiiBuffer)
    else if (type === 'raster') this._injectRaster(data.sourceName, data.tileID, data.built, data.image, data.featureGuides, data.time)
    else if (type === 'glyph') this._injectGlyphSourceData(data.sourceName, data.tileID, data.glyphFilterBuffer, data.glyphQuadBuffer, data.glyphColorBuffer, data.featureGuideBuffer)
    else if (type === 'glyphimages') this.painter.injectGlyphImages(data.maxHeight, data.images)
    else if (type === 'interactive') this._injectInteractiveData(data.sourceName, data.tileID, data.interactiveGuideBuffer, data.interactiveDataBuffer)
    else if (type === 'flush') this._injectFlush(data)
    else if (type === 'timesource') this._addTimeSource(data.sourceName, data.interval)
    // new 'paint', so painter is dirty
    this.painter.dirty = true
    this.render()
  }

  _injectFlush (data) {
    const { tileID } = data
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.flush(data)
    }
  }

  _buildTimeCache (timeSeries: TimeSeries) {
    const { parent, webworker } = this
    this.timeCache = new TimeCache(this, webworker, timeSeries)
  }

  _addTimeSource (sourceName: string, interval: number) {
    const { parent, webworker, timeCache } = this
    if (!timeCache) return
    timeCache.addSource(sourceName, interval)
  }

  _injectMaskGeometry (tileID: string | BigInt, vertexBuffer: ArrayBuffer,
    indexBuffer: ArrayBuffer, radiiBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectMaskGeometry(new Int16Array(vertexBuffer), new Uint32Array(indexBuffer), new Float32Array(radiiBuffer), this.style.mask)
    }
  }

  _injectVectorSourceData (sourceName: string, tileID: string | BigInt, vertexBuffer: ArrayBuffer,
    indexWeightBuffer: ArrayBuffer, fillIDBuffer: ArrayBuffer, codeTypeBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer,
    weight?: boolean = false) {
    if (this.tileCache.has(tileID)) {
      // get tile
      const tile = this.tileCache.get(tileID)
      // inject into tile
      tile.injectVectorSourceData(sourceName, new Int16Array(vertexBuffer), (weight) ? new Float32Array(indexWeightBuffer) : new Uint32Array(indexWeightBuffer), new Uint8Array(fillIDBuffer), codeTypeBuffer ? new Uint8Array(codeTypeBuffer) : null, new Float32Array(featureGuideBuffer), this.style.layers)
    }
  }

  async _injectRaster (sourceName: string, tileID: string | BigInt, built: boolean, image: ImageBitmap | ArrayBuffer, featureGuides: RasterFeatureGuide, time: number) {
    const { tileCache, timeCache, style } = this
    const { layers } = style
    if (tileCache.has(tileID)) {
      // get tile
      const tile = tileCache.get(tileID)
      // if not build yet, build the raster
      if (!built) image = await createImageBitmap(new Blob([image]))
      // inject into tile
      tile.injectRaster(sourceName, image, featureGuides, layers, time, timeCache)
    }
  }

  _injectGlyphSourceData (sourceName: string, tileID: string | BigInt, glyphFilterBuffer: ArrayBuffer,
    glyphQuadBuffer: ArrayBuffer, glyphColorBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    // store the vertexBuffer and texture in the gpu.
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectGlyphSourceData(
        sourceName, new Float32Array(glyphFilterBuffer), new Float32Array(glyphQuadBuffer),
        new Uint8ClampedArray(glyphColorBuffer), new Float32Array(featureGuideBuffer),
        this.style.layers
      )
    }
  }

  _injectInteractiveData (sourceName: string, tileID: string | BigInt, interactiveGuideBuffer: ArrayBuffer,
    interactiveDataBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectInteractiveData(sourceName, new Uint32Array(interactiveGuideBuffer), new Uint8Array(interactiveDataBuffer))
    }
  }

  getTile (tileID: BigInt) {
    return this.tileCache.get(tileID)
  }

  getTiles (): Array<Tile> {
    if (this.projector.dirty) {
      this.painter.dirty = true // to avoid re-requesting getTiles (which is expensive), we set painter.dirty to true
      this.projector.dirty = false
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
      if (newTiles.length) this.style.requestTiles(newTiles)
      // given the S2CellID, find them in cache and return them
      this.tilesInView = this.tileCache.getBatch(tilesInView)

      return this.tilesInView
    } else { return this.tilesInView }
  }

  _createFutureTiles (tiles: Array<BigInt>) {
    const { tileCache, painter, style } = this
    const newTiles = []
    // create the tiles
    for (const id of tiles) {
      if (!tileCache.has(id)) {
        const newTile = this._createTile(id)
        newTiles.push(newTile)
      }
    }
    // tell the style to make the requests
    painter.dirty = true
    style.requestTiles(newTiles)
  }

  _createTile (id: BigInt): Tile {
    const { style } = this
    // create tile
    const tile = new Tile(this.painter.context, id)
    // should our style have default layers, let's add them
    if (style.maskLayers && style.maskLayers.length) tile.injectMaskLayers(style.maskLayers)
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
    const tiles = this.getTiles()
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
    const tiles = this.getTiles()
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

// @flow
/** STYLE **/
import Style from '../../style'
/** PAINT **/
import { Painter } from '../../gl'
import type { MapOptions } from '../map'
/** PROJECTIONS **/
import { tileHash } from 's2projection' // https://github.com/Regia-Corporation/s2projection
import { OrthographicProjection, BlendProjection } from './projections'
import type { Projection } from './projections'
/** SOURCES **/
import { Tile, TileCache } from '../../source'

import type { Face } from 's2projection'

export type ProjectionType = 'perspective' | 'persp' | 'orthographic' | 'ortho' | 'orthographicPerspective' | 'blend'

export default class Camera {
  style: Style
  painter: Painter
  projection: Projection
  tileCache: TileCache
  tilesInView: Array<number> = [] // hash id's of the tiles
  lastTileViewState: Array<number> = []
  requestQueue: Array<Tile> = []
  zooming: null | SetTimeout = null
  request: null | SetTimeout = null
  _updateWhileZooming: boolean // this is a more cpu/gpu intensive redraw technique that will update tiles while the user is still zooming. This can cause overdrawing if the user is going to zoom from say 0 to 10 quickly.
  constructor (options: MapOptions) {
    this._updateWhileZooming = options.updateWhileZooming || true
    // setup projection
    this._createProjection(options)
    // prep the tileCache for future tiles
    this.tileCache = new TileCache()
  }

  // TODO: Perspective Projection
  _createProjection (options: MapOptions) {
    let { projection } = options
    if (!projection) projection = 'blend'
    if (projection === 'persp' || projection === 'perspective') {
      this.projection = new OrthographicProjection(options)
    } else if (projection === 'blend' || projection === 'orthographicPerspective') {
      this.projection = new BlendProjection(options)
    } else {
      this.projection = new OrthographicProjection(options)
    }
  }

  resizeCamera (width: number, height: number) {
    this.projection.resize(width, height)
    if (this.painter) this.painter.resize(width, height)
  }

  // TODO: On zooming start (this.lastTileViewState is empty) we set to tilesInView
  // during the zooming process, all newTiles need to be injected with whatever tiles
  // fit within it's view of lastTileViewState. Everytime we get zooming === false,
  // we set lastTileViewState to null again to ensure we don't inject tiles...
  // if updateTiles is set to false, we don't requestTiles unless zooming is off.
  // no matter what, if zooming is false, we check that each tile has made requests
  _getTiles (isZooming?: boolean) {
    if (this.projection.dirty) {
      // grab zoom change
      // const zoomChange = this.projection.zoomChange()
      // no matter what we need to update what's in view
      const newTiles = []
      // update tiles in view
      this.tilesInView = this.projection.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const tile of this.tilesInView) {
        const [face, zoom, x, y, hash] = tile
        if (!this.tileCache.has(hash)) {
          // tile not found, so we create it
          const newTile = this._createTile(face, zoom, x, y, hash)
          // store reference for the style to request from webworker(s)
          newTiles.push(newTile)
        }
      }
      if (newTiles.length) this.painter.dirty = true
      this.style.requestTiles(newTiles)
    }
    return this.tileCache.getBatch(this.tilesInView.map(t => t[4]))
  }

  _createTile (face: Face, zoom: number, x: number, y: number, hash: number): Tile {
    // create tile
    const tile = new Tile(this.painter.context, face, zoom, x, y, hash)
    // inject parent should one exist
    if (tile.zoom !== 0) {
      // get closest parent hash. If actively zooming, the parent tile will pass along
      // it's parent tile (and so forth) if its own data has not been processed yet.
      const parentHash = tileHash(tile.face, tile.zoom - 1, Math.floor(tile.x / 2), Math.floor(tile.y / 2))
      // check if parent tile exists, if so inject
      if (this.tileCache.has(parentHash)) {
        const parent = this.tileCache.get(parentHash)
        tile.injectParentTile(parent)
      }
    }
    // prep raster containers if said layers exist
    this.prepRasterContainers(tile)
    // store the tile
    this.tileCache.set(hash, tile)

    return tile
  }

  prepRasterContainers (tile: Tile) {
    const self = this
    const { rasterLayers } = self.style
    for (const sourceName in rasterLayers) {
      // grab the source and layer details
      const layer = rasterLayers[sourceName]
      // create texture and recieve the pieces that need to be requested
      tile.buildSourceTexture(sourceName, layer)
    }
  }

  // avoid over-asking for tiles if we are zooming quickly
  _setRequestQueue (tiles: Array<Tile>) {
    const self = this
    // first clear timer
    if (self.request) clearTimeout(self.request)
    // set a new timer that eventually makes the requests
    self.request = setTimeout(() => {
      self.style.requestTiles(self.requestQueue)
    }, 150)
  }

  injectVectorSourceData (source: string, tileID: number, parentLayers, vertexBuffer: ArrayBuffer,
    indexBuffer: ArrayBuffer, codeOffsetBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    let children: boolean = false
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      children = Object.keys(tile.childrenRequests).length > 0
      tile.injectVectorSourceData(source, new Float32Array(vertexBuffer), new Uint32Array(indexBuffer), new Uint8Array(codeOffsetBuffer), new Uint32Array(featureGuideBuffer), this.style.layers)
      // for each parentLayer, inject specified layers
      for (let hash in parentLayers) {
        hash = +hash
        if (this.tileCache.has(hash)) {
          const parent = this.tileCache.get(hash)
          tile.injectParentTile(parent, parentLayers[hash].layers)
        } else {
          // if parent tile does not exist: create, set all the child's requests,
          // and tell the styler to request the webworker(s) to process the tile
          const { face, zoom, x, y } = parentLayers[hash]
          const newTile = this._createTile(face, zoom, x, y, hash)
          for (const layer of parentLayers[hash].layers) newTile.childrenRequests[layer] = [tile]
          this.style.requestTiles([newTile])
        }
      }
      // new 'paint', so painter is dirty
      this.painter.dirty = true
      // call a re-render only if the tile is in our current viewing or it had children
      if (this.tilesInView.map(t => t[4]).includes(tileID) || children) this._render()
    }
  }

  injectTextSourceData (source: string, tileID: string, vertexBuffer: ArrayBuffer,
    texPositionBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer, imageBitmap: ImageBitmap) {
    // store the vertexBuffer and texture in the gpu.
    let children: boolean = false
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      children = Object.keys(tile.childrenRequests).length > 0
      tile.injectTextSourceData(source, new Float32Array(vertexBuffer),
        new Int16Array(texPositionBuffer), new Uint32Array(featureGuideBuffer),
        imageBitmap, this.style.layers)
    }
    // new 'paint', so painter is dirty
    this.painter.dirty = true
    // call a re-render only if the tile is in our current viewing or it had children
    if (this.tilesInView.map(t => t[4]).includes(tileID) || children) this._render()
  }

  injectRasterData (source: string, tileID: string, image: ImageBitmap,
    leftShift: number, bottomShift: number) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectRasterData(source, image, leftShift, bottomShift)
      // new 'paint', so painter is dirty
      this.painter.dirty = true
      // call a re-render only if the tile is in our current viewing
      if (this.tilesInView.map(t => t[4]).includes(tileID)) this._render()
    }
  }

  injectMaskGeometry (tileID: number, vertexBuffer: ArrayBuffer,
    indexBuffer: ArrayBuffer, radiiBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectMaskGeometry(new Float32Array(vertexBuffer), new Uint32Array(indexBuffer), new Float32Array(radiiBuffer), this.style.mask)
      // new 'paint', so painter is dirty
      this.painter.dirty = true
      // call a re-render only if the tile is in our current viewing
      if (this.tilesInView.map(t => t[4]).includes(tileID)) this._render()
    }
  }

  _render (isZooming?: boolean = false) {
    // dummy check, if nothing has changed, do nothing
    if (!this.painter.dirty && !this.style.dirty && !this.projection.dirty) return
    // prep tiles
    const tiles = this._getTiles(isZooming)
    // paint scene
    this.painter.paint(this.projection, this.style, tiles)
    // at the end of a scene render, we know Projection and Style are up to date
    this.painter.dirty = false
    this.style.dirty = false
    this.projection.dirty = false
  }
}

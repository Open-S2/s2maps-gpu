// @flow
/** STYLE **/
import Style from '../../style'
/** PAINT **/
import { Painter } from '../../gl'
import type { MapOptions } from '../map'
/** PROJECTIONS **/
import { OrthographicProjection, BlendProjection } from './projections'
import type { Projection } from './projections'
/** SOURCES **/
import { Tile, TileCache } from '../../source'

export type ProjectionType = 'perspective' | 'persp' | 'ortho' | 'orthographic' | 'blend' | 'orthographicPerspective'

export default class Camera {
  style: Style
  painter: Painter
  projection: Projection
  wallpaper: Wallpaper
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
  }

  // TODO: On zooming start (this.lastTileViewState is empty) we set to tilesInView
  // during the zooming process, all newTiles need to be injected with whatever tiles
  // fit within it's view of lastTileViewState. Everytime we get zooming === false,
  // we set lastTileViewState to null again to ensure we don't inject tiles...
  // if updateTiles is set to false, we don't requestTiles unless zooming is off.
  // no matter what, if zooming is false, we check that each tile has made requests
  _getTiles (isZooming?: boolean) {
    const self = this
    if (self.projection.dirty) {
      // grab zoom change
      const zoomChange = self.projection.zoomChange()
      // no matter what we need to update what's in view
      const newTiles = []
      // update tiles in view
      self.tilesInView = self.projection.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const tile of self.tilesInView) {
        const [face, zoom, x, y, hash] = tile
        if (!self.tileCache.has(hash)) {
          // tile not found, so we create it
          const newTile = new Tile(self.painter.context, face, zoom, x, y, hash)
          // inject parent should one exist
          if (zoomChange) newTile.injectParentTile(this.tileCache)
          // start requesting raster data if exists
          self._requestRasterData(newTile)
          // store the tile
          self.tileCache.set(hash, newTile)
          newTiles.push(newTile)
        }
      }
      if (newTiles.length) this.painter.dirty = true
      self.style.requestTiles(newTiles)
    }
    return self.tileCache.getBatch(self.tilesInView.map(t => t[4]))
  }

  _requestRasterData (tile: Tile) {
    const self = this
    const { rasterLayers } = self.style
    for (const sourceName in rasterLayers) {
      // grab the source and layer details
      const source = self.style.sources[sourceName]
      const layer = rasterLayers[sourceName]
      // create texture and recieve the pieces that need to be requested
      const pieces = tile.buildSourceTexture(sourceName, layer)
      // start requesting tiles
      for (const piece of pieces) {
        const image = new Image()
        image.crossOrigin = 'anonymous'
        image.src = `${source.path}/${piece.face}/${piece.zoom}/${piece.x}/${piece.y}.${source.fileType}`
        image.onload = () => {
          // inject the image into the raster in its proper position
          tile._injectRasterData(sourceName, image, piece.leftShift, piece.bottomShift)
          // new paint, so painter is dirty
          self.painter.dirty = true
          // call a re-render only if the tile is in our current viewing
          if (self.tilesInView.map(t => t[4]).includes(tile.id)) self._render()
        }
      }
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

  injectVectorSourceData (source: string, tileID: number, vertexBuffer: ArrayBuffer,
    indexBuffer: ArrayBuffer, codeOffsetBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectVectorSourceData(source, new Float32Array(vertexBuffer), new Uint32Array(indexBuffer), new Uint8Array(codeOffsetBuffer), new Uint32Array(featureGuideBuffer), this.style.layers)
      // new paint, so painter is dirty
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

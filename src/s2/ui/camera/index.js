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
import { Wallpaper, Tile, TileCache } from '../../source'

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

  _setupInitialScene () {
    // create the wallpaper
    this.wallpaper = new Wallpaper(this.style, this.projection)
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
      if (isZooming) {
        if (!self.lastTileViewState) self.lastTileViewState = self.tilesInView
        if (self.zooming) clearTimeout(self.zooming)
        self.zooming = setTimeout (() => {
          self.zooming = null
          self.lastTileViewState = null
        }, 150)
      }
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
          // inject parent/children should they exist
          if (zoomChange) newTile.injectParentChildTiles(self.lastTileViewState)
          // store the tile
          self.tileCache.set(hash, newTile)
          newTiles.push(newTile)
        }
      }
      // if there was a zoom change, we store requests
      // if (newTiles.length) {
      //   if (self.request || !!zoomChange) {
      //     self._setRequestQueue(newTiles)
      //   } else { self.style.requestTiles(newTiles) } // if we only dragged/panned we request tiles immediately
      // }
      self.style.requestTiles(newTiles)
    }
    return self.tileCache.getBatch(self.tilesInView.map(tArr => tArr[4]))
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
    indexBuffer: ArrayBuffer, featureIndexBuffer: ArrayBuffer, featureGuideBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectVectorSourceData(source, new Float32Array(vertexBuffer), new Uint32Array(indexBuffer), new Uint8Array(featureIndexBuffer), new Uint32Array(featureGuideBuffer), this.style.layers)
      // call a re-render only if the tile is in our current viewing
      if (this.tilesInView.map(tArr => tArr[4]).includes(tileID)) this._render()
      // new paint, so painter is dirty
      this.painter.dirty = true
    }
  }

  _render (isZooming?: boolean = false) {
    // dummy check, if nothing has changed, do nothing
    if (!this.painter.dirty && !this.style.dirty && !this.projection.dirty) return
    // prep tiles
    const tiles = this._getTiles(isZooming)
    // paint scene
    this.painter.paint(this.wallpaper, this.projection, this.style, tiles)
    // at the end of a scene render, we know Projection and Style are up to date
    this.painter.dirty = true
    this.style.dirty = false
    this.projection.dirty = false
  }
}

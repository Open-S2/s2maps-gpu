// @flow
/** STYLE **/
import Style from '../../style'
/** PAINT **/
import { Painter } from '../../gl'
import type { MapOptions } from '../map'
/** PROJECTIONS **/
import { OrthographicProjection, BlendProjection, Projection } from './projections'
/** SOURCES **/
import { Wallpaper, Tile, TileCache } from '../../source'

export type ProjectionType = 'perspective' | 'persp' | 'ortho' | 'orthographic' | 'blend' | 'orthographicPerspective'

export default class Camera {
  style: Style
  painter: Painter
  projection: Projection
  wallpaper: Wallpaper
  tileCache: TileCache
  tilesInView: Array<number> // hash id's of the tiles
  constructor (options: MapOptions) {
    this._createProjection(options.projection || 'blend')
    this.tileCache = new TileCache()
  }

  _onZoom (delta: number) {
    this.projection.onZoom(delta)
  }

  _createProjection (projection: ProjectionType) {
    if (projection === 'persp' || projection === 'perspective') { // TODO
      this.projection = new OrthographicProjection()
    } else if (projection === 'blend' || projection === 'orthographicPerspective') {
      this.projection = new BlendProjection()
    } else {
      this.projection = new OrthographicProjection()
    }
  }

  resizeCamera (width: number, height: number) {
    this.projection.resize(width, height)
  }

  _setupInitialScene () {
    // create the wallpaper
    this.wallpaper = new Wallpaper(this.style, this.projection)
  }

  _getTiles () {
    if (this.projection.dirty) {
      const newTiles = []
      // update tiles in view
      this.tilesInView = this.projection.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (tile of this.tilesInView) {
        const [face, zoom, x, y, hash] = tile
        if (!this.tileCache.has(hash)) {
          const newTile = new Tile(face, zoom, x, y, hash)
          this.tileCache.set(hash, newTile)
          newTiles.push(newTile)
        }
      }
      // send off the appropraite requests using the style manager
      if (newTiles.length) this.style.requestTiles(newTiles)
    }
    return this.tileCache.getBatch(this.tilesInView)
  }

  _render () {
    // prep tiles
    const tiles = this._getTiles()
    // paint scene
    this.painter.paint(this.wallpaper, tiles)
    // at the end of a scene render, we know Projection and Style are up to date
    this.painter.dirty = false
    this.style.dirty = false
  }
}

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
  constructor (options: MapOptions) {
    this._createProjection(options)
    this.tileCache = new TileCache()
  }

  // TODO
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

  _getTiles (updateTiles: boolean) {
    if (updateTiles && this.projection.dirty) {
      const newTiles = []
      // update tiles in view
      this.tilesInView = this.projection.getTilesInView()
      // check if any of the tiles don't exist in the cache. If they don't create a new tile
      for (const tile of this.tilesInView) {
        const [face, zoom, x, y, hash] = tile
        if (!this.tileCache.has(hash)) {
          // tile not found, so we create it
          const newTile = new Tile(face, zoom, x, y, hash)
          // inject parent or children data if they exist
          newTile.injectParentOrChildren(this.tileCache)
          // build the VAO
          this.painter.buildVAO(newTile)
          // store the tile
          this.tileCache.set(hash, newTile)
          newTiles.push(newTile)
        }
      }
      // send off the appropraite requests using the style manager
      if (newTiles.length) this.style.requestTiles(newTiles)
    }
    return this.tileCache.getBatch(this.tilesInView.map(tArr => tArr[4]))
  }

  injectSourceData (source: string, tileID: number, vertexBuffer: ArrayBuffer, indexBuffer: ArrayBuffer, layerGuideBuffer: ArrayBuffer) {
    if (this.tileCache.has(tileID)) {
      const tile = this.tileCache.get(tileID)
      tile.injectSourceData(source, new Float32Array(vertexBuffer), new Uint32Array(indexBuffer), new Uint32Array(layerGuideBuffer), this.style.layers)
      // build the VAO
      this.painter.buildVAO(tile)
    }
    // re-render
    this._render()
  }

  _render (updateTiles?: boolean = true) {
    // prep tiles
    const tiles = this._getTiles(updateTiles)
    // paint scene
    this.painter.paint(this.wallpaper, this.projection, this.style, tiles)
    // at the end of a scene render, we know Projection and Style are up to date
    this.painter.dirty = false
    this.style.dirty = false
  }
}

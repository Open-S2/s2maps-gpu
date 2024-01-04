/* eslint-env browser */
/** CAMERA **/
import Camera from './camera/index'
/** SOURCES **/
import Animator from './camera/animator'

import type { GPUType, LayerStyle, StyleDefinition } from 'style/style.spec'
import type { AnimationDirections, AnimationType } from './camera/animator'
import type { UserTouchEvent } from './camera/dragPan'
import type { TileWorkerMessage } from 'workers/worker.spec'
import type { ColorMode } from 's2Map'

export interface MapOptions {
  contextType?: GPUType // can force a specific context type (1 -> webgl1, 2 -> webgl2, 3 -> webgpu)
  /** support OffscreenCanvas */
  offscreen?: false
  canvas?: HTMLCanvasElement
  /** can be a reference to an ID or an HTMLElement */
  container?: string | HTMLElement
  interactive?: boolean
  apiKey?: string
  style: StyleDefinition | string // URL to a StyleDefinition or a StyleDefinition object
  scrollZoom?: boolean
  positionalZoom?: boolean // If true, cursor position impacts zoom's x & y directions [default: true]
  canvasMultiplier?: number
  attributions?: Record<string, string>
  attributionOff?: boolean
  infoLayers?: string[]
  controls?: boolean // zoom, compass, and colorblind turned on or off
  zoomController?: boolean
  compassController?: boolean
  colorblindController?: boolean
  canZoom?: boolean
  canMove?: boolean
  darkMode?: boolean
  // TODO: pushing this into options is not the play
  webworker?: boolean
  noClamp?: boolean // lat and lon can be any number
}

export default class S2MapUI extends Camera {
  renderNextFrame = false
  injectionQueue: TileWorkerMessage[] = []

  /* API */

  delete (): void {
    // delete all tiles
    this.tileCache.deleteAll()
    // to ensure no more draws, set the draw method to a noop
    this._draw = () => { /* noop */ }
    // tell the painter to cleanup
    this.painter.delete()
  }

  jumpTo (lon: number, lat: number, zoom?: number): void {
    // update the projectors position
    this.projector.setPosition(lon, lat, zoom)
    // render it out
    this.render()
  }

  animateTo (type: AnimationType, directions?: AnimationDirections): void {
    // build animator
    const animator = new Animator(this.projector, directions)
    const render = (type === 'flyTo') ? animator.flyTo() : animator.easeTo()
    if (!render) return
    // set an animation fuction
    this.currAnimFunction = (now: number): void => { this._animate(animator, now * 0.001) }
    // render it out
    this.render()
  }

  async setStyle (style: string | StyleDefinition, ignorePosition: boolean): Promise<void> {
    await this._setStyle(style, ignorePosition)
  }

  // 1) updateStyle from the style object. return a list of "from->to" for tiles and "layerIDs" for webworkers
  // 2) remove tiles from tileCache not in view
  // 3) update the tileCache tiles using "from->to"
  // 4) if a layer "source", "layer", or "filter" change it will be in "webworkers". Tell webworkers to rebuild
  updateStyle (style: StyleDefinition): void {
    // // build style for the map, painter, and webworkers
    // Style.updateStyle(style)
    // remove any tiles outside of view
    // this._resetTileCache([], false, true)
    // // update tileCache
    // this.tileCache.forEach(tile => { tile.updateStyle(Style) })
    // // inject minzoom and maxzoom
    // this.projector.setStyleParameters(Style, true)
    // // render our first pass
    // this.render()
  }

  clearSource (sourceNames: string[]): void {
    // delete source data from all tiles
    this.tileCache.forEach(tile => { tile.deleteSources(sourceNames) })
    // let the renderer know the painter is "dirty"
    this.painter.dirty = true
    // rerender
    this.render()
  }

  // sources: Array<[sourceName, href]>
  resetSource (
    sources: Array<[string, string | undefined]>,
    keepCache = false,
    awaitReplace = false
  ): void {
    const tileRequests = this._resetTileCache(sources.map(s => s[0]), keepCache, awaitReplace)
    // Send off the tile request (by including sourceNames we are letting the
    // source worker know we only need to update THIS source)
    if (tileRequests.length > 0) {
      if (this.webworker) {
        postMessage({ mapID: this.id, type: 'tilerequest', tiles: tileRequests, sources })
      } else {
        window.S2WorkerPool.tileRequest(this.id, tileRequests, sources)
      }
    }
    // let the renderer know the painter is "dirty"
    this.painter.dirty = true
    // rerender
    this.render()
  }

  addLayer (layer: LayerStyle, nameIndex: number | string): void {
    // // remove all tiles outside of view
    // const tileRequests = this._resetTileCache([], false, true)
    // // style needs to be updated on the change
    // Style.addLayer(layer, nameIndex, tileRequests)
    // // rerender
    // this.render()
  }

  removeLayer (nameIndex: number | string): void {
    // // style needs to be updated on the change
    // const index = Style.removeLayer(nameIndex)
    // // remove all instances of the layer in each tile
    // this.tileCache.forEach(tile => { tile.removeLayer(index) })
    // // rerender
    // this.render()
  }

  reorderLayers (layerChanges: Record<number, number>): void {
    // // style needs to updated on the change
    // this.style.reorderLayers(layerChanges)
    // // update every tile
    // this.tileCache.forEach(tile => { tile.reorderLayers(layerChanges) })
    // // rerender
    // this.render()
  }

  updateLayer (layer: LayerStyle, nameIndex: number | string, fullUpdate = false): void {
    // TODO
  }

  setMoveState (state: boolean): void {
    this.canMove = state
  }

  setZoomState (state: boolean): void {
    this.canZoom = state
  }

  onZoom (deltaZ: number, deltaX = 0, deltaY = 0): void {
    this.dragPan.clear()
    if (!this.canZoom) return
    // remove any prexisting animations
    this.currAnimFunction = undefined
    // update projector
    this.projector.onZoom(deltaZ, deltaX, deltaY)
    // render
    this.render()
  }

  updateCompass (bearing?: number, pitch?: number): void {
    const { projector } = this
    this.currAnimFunction = undefined
    projector.setCompass(
      projector.bearing + (bearing ?? projector.bearing),
      projector.pitch + (pitch ?? projector.pitch)
    )
    this.render()
  }

  // snap to upside down if interested
  mouseupCompass (): void {
    const { projector } = this
    const { bearing } = projector
    if (bearing === 0) return
    const newBearing = (bearing >= -10 && bearing <= 10)
      ? 0
      : (bearing <= -167.5)
          ? -180
          : (bearing >= 167.5)
              ? 180
              : undefined
    if (newBearing !== undefined) {
      const animator = new Animator(projector, { duration: 1, bearing: newBearing })
      animator.compassTo()
      this.currAnimFunction = (now: number) => { this._animate(animator, now * 0.001) }
      this.render()
    }
  }

  resetCompass (): void {
    const { projector } = this
    const { bearing, pitch } = projector
    // create the animator
    const duration = bearing !== 0 ? ((bearing > 90) ? 1.75 : 1) : 1
    const animator = new Animator(projector, { duration, bearing: 0, pitch: bearing !== 0 ? bearing : pitch })
    animator.compassTo()
    this.currAnimFunction = (now: number) => { this._animate(animator, now * 0.001) }
    // send off a render
    this.render()
  }

  resize (width: number, height: number): void {
    this.resizeQueued = { width, height }
    this.render()
  }

  screenshot (): void {
    requestAnimationFrame(() => {
      if (this.#fullyRenderedScreen()) {
        // assuming the screen is ready for a screen shot we ask for a draw
        this.painter.getScreen()
          .then(screen => {
            if (this.webworker) {
              postMessage({ type: 'screenshot', screen })
            } else {
              this.parent?.dispatchEvent(new CustomEvent('screenshot', { detail: screen }))
            }
          })
      } else { this.screenshot() }
    })
  }

  #fullyRenderedScreen (): boolean {
    const tiles = this.getTiles()
    let fullyRendered = true
    for (const tile of tiles) {
      if (!tile.rendered) {
        fullyRendered = false
        break
      }
    }
    return fullyRendered
  }

  // some cases we can just do the work immediately, otherwise we do one job per frame
  // to improve performance. Data is stored in the injection queue while it waits for it's frame.
  injectData (data: TileWorkerMessage): void {
    if (data.type === 'flush') this._injectData(data)
    else this.injectionQueue.push(data)
    this.render()
  }

  /* INPUT EVENTS */

  colorMode (mode: ColorMode): void {
    this.painter.setColorMode(mode)
    // force a re-render
    this.render()
  }

  // for interaction with features on the screen
  onCanvasMouseMove (x: number, y: number): void {
    if (!this._interactive) return
    this._setMousePosition(x, y)
    this.mouseMoved = true
    this.render()
  }

  onTouchStart (touches: UserTouchEvent): void {
    this.dragPan.onTouchStart(touches)
    if (!this._interactive || touches.length > 1) return
    const { x, y } = touches[0]
    this._setMousePosition(x, y)
    this.mouseMoved = true
    this.render()
  }

  // builtin navigation controller inputs
  navEvent (ctrl: 'zoomIn' | 'zoomOut', lon?: number, lat?: number): void {
    this._navEvent(ctrl, lon, lat)
  }

  /* DRAW */

  // we don't want to over request rendering, so we render with a limiter to
  // safely call render as many times as we like
  render (): void {
    if (!this._canDraw) return
    if (this.renderNextFrame) return
    this.renderNextFrame = true
    requestAnimationFrame(now => {
      this.renderNextFrame = false
      // if timeCache exists, run animation function
      this.timeCache?.animate(now, this._updatePainter.bind(this))
      // if animation currently exists, run it
      this.currAnimFunction?.(now)
      // if resize has been queued, we do so now
      if (this.resizeQueued !== undefined) this._resize()
      // if there is data to 'inject', we make sure to render another frame later
      if (this.injectionQueue.length > 0) {
        // pull out the latest data we received (think about it, the newest data is the most constructive)
        const data = this.injectionQueue.pop()
        // tell the camera to inject data
        if (data !== undefined) this._injectData(data)
        // setup another render queue
        this.render()
      }
      // get state of scene
      const projectorDirty = this.projector.dirty
      // if the projector was dirty (zoom or movement) we run render again just incase
      if (projectorDirty) {
        this.render()
        this._onPositionUpdate()
      }
      // run a draw, it will repaint framebuffers as necessary
      try {
        this._draw()
      } catch (e) {
        this._canDraw = false
        throw e
      }
      // if mouse movement, check feature at position
      if (this.mouseMoved && !projectorDirty) {
        this.mouseMoved = false
        void this._onCanvasMouseMove()
      }
    })
  }
}

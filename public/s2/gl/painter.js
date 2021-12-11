// @flow
import Style from '../style'
/** CONTEXTS **/
import { WebGL2Context, WebGLContext } from './contexts'
/** SOURCES **/
import { Tile } from '../source'

import type { MapOptions } from '../ui/map'
import type { Projection } from '../ui/camera/projections'
import type { FeatureGuide } from '../source/tile'
import type { Program, ProgramType } from './programs/program'
import type { GlyphImages } from '../workers/source/glyphSource'

type ProgramGL = FillProgram | GlyphFilterProgram | GlyphProgram | HeatmapProgram | LineProgram | PointProgram | RasterProgram | ShadeProgram | SkyboxProgram | WallpaperProgram

export default class Painter {
  context: WebGL2Context | WebGLContext
  programs: { [string]: Program } = {}
  currProgram: ProgramType
  dirty: boolean = true
  constructor (context: WebGL2Context | WebGLContext,
    type: 1 | 2, options: MapOptions) {
    this.context = context
    // build a context API
    if (type === 2) this.context = new WebGL2Context(context, options)
    else this.context = new WebGLContext(context, options)
  }

  delete () {
    const { context, programs } = this
    for (const programName in programs) programs[programName].delete()
    context.delete()
  }

  async buildPrograms (buildSet: Set<ProgramType>) {
    const { programs, context } = this
    for (const program of buildSet) {
      switch (program) {
        case 'raster':
          programs.raster = await import('./programs/rasterProgram').then(P => { return new P.default(context) })
          break
        case 'fill':
          // programs.fill = new FillProgram(context)
          programs.fill = await import('./programs/fillProgram').then(P => { return new P.default(context) })
          break
        case 'line':
          programs.line = await import('./programs/lineProgram').then(P => { return new P.default(context) })
          break
        case 'point':
          programs.point = await import('./programs/pointProgram').then(P => { return new P.default(context) })
          break
        case 'heatmap':
          programs.heatmap = await import('./programs/heatmapProgram').then(P => { return new P.default(context) })
          break
        case 'shade':
          programs.shade = await import('./programs/shadeProgram').then(P => { return new P.default(context) })
          break
        case 'glyph':
          programs.glyphFilter = await import('./programs/glyphFilterProgram').then(P => { return new P.default(context) })
          programs.glyph = await import('./programs/glyphProgram').then(P => { return new P.default(context, programs.glyphFilter) })
          break
        case 'wallpaper':
          programs.wallpaper = await import('./programs/wallpaperProgram').then(P => { return new P.default(context) })
          break
        case 'skybox':
          programs.skybox = await import('./programs/skyboxProgram').then(P => { return new P.default(context) })
          break
        default: break
      }
    }
  }

  injectFrameUniforms (matrix: Float32Array, view: Float32Array, aspect: Float32Array) {
    const { programs } = this
    for (const programName in programs) programs[programName].injectFrameUniforms(matrix, view, aspect)
  }

  useProgram (programName: ProgramType): ProgramGL {
    const program = this.programs[programName]
    // if (this.currProgram !== programName) {
    //   this.currProgram = programName
    //   program.use()
    // }
    program.use()
    return program
  }

  resize () {
    const { context } = this
    // If we are using the text program, update the text program's framebuffer component's sizes
    const glyphFilter: GlyphFilterProgram = this.programs.glyphFilter
    const heatmap: HeatmapProgram = this.programs.heatmap
    if (glyphFilter) glyphFilter.resize()
    if (heatmap) heatmap.resize()
    // ensure interaction buffer is accurate
    context.resizeInteract()
    // ensure our default viewport is accurate
    context.resetViewport()
    // notify that the painter is dirty
    this.dirty = true
  }

  paint (projection: Projection, style: Style, tiles: Array<Tile>) {
    const { context } = this
    // PREPARE PHASE
    // prep frame uniforms
    const { view, aspect } = projection
    const matrix = projection.getMatrix('m')
    this.injectFrameUniforms(matrix, view, aspect)
    // prep mask id's
    this._createTileMasksIDs(tiles)
    // prep all tile's features to draw
    // $FlowIgnore
    const features = tiles.flatMap(tile => tile.featureGuide.filter(f => f.type !== 'heatmap'))
    // draw heatmap data if applicable
    const heatmapFeatures = tiles.flatMap(tile => tile.featureGuide.filter(f => f.type === 'heatmap'))
    if (heatmapFeatures.length) features.push(this.paintHeatmap(heatmapFeatures))
    // sort features
    features.sort(featureSort)
    // corner case: all features tiles past zoom 12 must set screen positions
    const featureTiles = features.map(f => f.parent ? f.parent : f.tile)
    for (const tile of featureTiles) tile.setScreenPositions(projection)
    // prep glyph features for drawing box filters
    const glyphFeatures = features.filter(feature => feature.type === 'glyph' && !feature.overdraw)
    // use text boxes to filter out overlap
    if (glyphFeatures.length) this.paintGlyphFilter(glyphFeatures)
    // return to our default framebuffer
    context.bindMainBuffer()
    // clear main buffer
    context.newScene()

    // DRAW PHASE
    // prep masks
    this.paintMasks(tiles)
    // draw the wallpaper
    if (style.wallpaper) {
      const wallpaperProgram: WallpaperProgram = this.useProgram(style.wallpaper.skybox ? 'skybox' : 'wallpaper')
      if (wallpaperProgram) wallpaperProgram.draw(style.wallpaper)
    }
    // paint opaque fills
    const opaqueFillFeatures = features.filter(feature => feature.opaque).reverse()
    this.paintFeatures(opaqueFillFeatures, false, tiles)
    // paint features
    const residualFeatures = features.filter(feature => !feature.opaque)
    this.paintFeatures(residualFeatures, false, tiles)
    // cleanup
    context.cleanup()
  }

  paintInteractive (tiles: Array<Tile>) {
    const interactiveFeatures = tiles
      .flatMap(tile => tile.featureGuide)
      .sort(featureSort)
      .filter(feature => feature.interactive)
      .reverse()
    if (interactiveFeatures.length) {
      // prepare
      this.context.clearInteractBuffer()
      // draw
      this.paintFeatures(interactiveFeatures, true, tiles)
    }
  }

  _createTileMasksIDs (tiles: Array<Tile>) {
    let maskRef = 1
    // add all tiles
    for (const tile of tiles) {
      tile.tmpMaskID = maskRef
      maskRef++
    }
  }

  paintMasks (tiles: Array<Tile>) {
    // get context
    const { context } = this
    const { gl } = context
    // prep the fill program
    const fillProgram: FillProgram = this.useProgram('fill')
    // prep stencil - don't draw color, only to the stencil
    context.enableMaskTest()
    context.lequalDepth()
    gl.stencilOp(gl.KEEP, gl.KEEP, gl.REPLACE)
    // create mask for each tile
    for (const tile of tiles) {
      const { tmpMaskID, faceST, bottom, top, sourceData } = tile
      const { mask } = sourceData
      // set uniforms & stencil test
      fillProgram.setFaceST(faceST)
      fillProgram.setTilePos(bottom, top)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, tmpMaskID, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      fillProgram.draw(mask, mask)
    }
    // lock in the stencil, draw colors again
    gl.colorMask(true, true, true, true)
  }

  paintFeatures (features: Array<FeatureGuide>, interactive: boolean, tiles: Array<Tile>) {
    // setup context
    const { context } = this
    const { gl } = context
    // setup variables
    let curLayer: number = -1
    let inversion: number = null
    let program: Program
    // run through the features, and upon tile, layer, or program change, adjust accordingly
    for (const feature of features) {
      const {
        tile, parent, layerIndex, source, invert, faceST,
        depthPos, type, layerCode, lch
      } = feature
      const { tmpMaskID } = tile
      const { bottom, top } = parent || tile
      // inversion flush if necessary
      if (inversion && curLayer !== layerIndex) {
        this.flushInvert(tiles, program, inversion)
        inversion = null
      }
      // set program
      program = this.useProgram(type)
      // set stencil
      gl.stencilFunc(gl.EQUAL, tmpMaskID, 0xFF)
      // update layerCode if the current layer has changed
      if (curLayer !== layerIndex) {
        // now setup new layercode
        curLayer = layerIndex
        if (layerCode) program.setLayerCode(layerCode, lch)
        // set interactive if applicable
        program.setInteractive(interactive)
        // if this new layer is inverting its draw, we set
        if (invert && !inversion) {
          gl.colorMask(false, false, false, false)
          inversion = depthPos
        }
      }
      // adjust tile uniforms
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      // bind vao
      gl.bindVertexArray(source.vao)
      // draw
      program.draw(feature, source, interactive)
    }
  }

  // run through tiles and draw the masks, inject depthPos and
  flushInvert (tiles: Array<Tile>, program: Program, depthPos: number) {
    const { gl } = this.context
    // turn color back on
    gl.colorMask(true, true, true, true)
    // draw tile masks
    for (const tile of tiles) {
      const { tmpMaskID, faceST, bottom, top, sourceData } = tile
      const { mask } = sourceData
      // inject depthPos
      mask.depthPos = depthPos
      // set uniforms & stencil test
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      // set correct tile mask
      gl.stencilFunc(gl.ALWAYS, tmpMaskID, 0xFF)
      // use mask vao and fill program
      gl.bindVertexArray(mask.vao)
      // draw mask
      program.draw(mask, mask)
      // remove depthPos
      mask.depthPos = null
    }
  }

  paintHeatmap (features: Array<FeatureGuide>) {
    const { gl } = this.context
    // grab heatmap program
    const program = this.useProgram('heatmap')
    // setup texture draws
    program.setupTextureDraw()
    // draw all features
    for (const feature of features) {
      const { tile, parent, source, layerCode, faceST } = feature
      // grab bottom-top
      const { bottom, top } = parent || tile
      // set faceST & layercode, bind vao, and draw
      program.setFaceST(faceST)
      program.setTilePos(bottom, top)
      if (layerCode) program.setLayerCode(layerCode)
      gl.bindVertexArray(source.vao)
      program.drawTexture(feature, source)
    }
    // prep program for canvas draws
    program.setupCanvasDraw()
    // return a "featureGuide" to draw to the screen
    return features[0]
  }

  paintGlyphFilter (glyphFeatures: Array<FeatureGuide>) {
    const glyphFilterProgram: GlyphFilterProgram = this.useProgram('glyphFilter')
    // Step 1: draw quads
    glyphFilterProgram.bindQuadFrameBuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 1)

    // // glyphFilterProgram.quadTexture
    // const pixels = new Uint8Array(2048 * 2 * 4)
    // gl.readPixels(0, 0, 2048, 2, gl.RGBA, gl.UNSIGNED_BYTE, pixels)
    // // console.log('pixels', pixels)
    // const bboxs = []
    // for (let i = 0; i < 40; i++) {
    //   const left = (pixels[i * 4] << 8) + (pixels[i * 4 + 1])
    //   const bottom = (pixels[i * 4 + 2] << 8) + (pixels[i * 4 + 3])
    //   const right = (pixels[(i + 2048) * 4] << 8) + (pixels[(i + 2048) * 4 + 1])
    //   const top = (pixels[(i + 2048) * 4 + 2] << 8) + (pixels[(i + 2048) * 4 + 3])
    //   bboxs.push([left, bottom, right, top])
    // }
    // console.log(bboxs)

    // Step 2: draw result points
    glyphFilterProgram.bindResultFramebuffer()
    this._paintGlyphFilter(glyphFilterProgram, glyphFeatures, 2)
  }

  getScreen (): Uint8ClampedArray {
    const { gl } = this.context
    const { width, height, RGBA, UNSIGNED_BYTE } = gl
    const pixels = new Uint8ClampedArray(width * height * 4)
    gl.readPixels(0, 0, width, height, RGBA, UNSIGNED_BYTE, pixels)

    return pixels
  }

  _paintGlyphFilter (glyphFilterProgram: GlyphFilterProgram, glyphFeatures: Array<FeatureGuide>, mode: 1 | 2) {
    const { context } = this
    const { gl } = context
    let curLayer: number = -1
    // set mode
    glyphFilterProgram.setMode(mode)
    // draw each feature
    for (const glyphFeature of glyphFeatures) {
      const { tile, parent, layerIndex, source, layerCode, faceST } = glyphFeature
      const { bottom, top } = parent || tile
      // update layerIndex
      if (curLayer !== layerIndex && layerCode) {
        curLayer = layerIndex
        glyphFilterProgram.setLayerCode(layerCode)
      }
      glyphFilterProgram.setFaceST(faceST)
      glyphFilterProgram.setTilePos(bottom, top)
      gl.bindVertexArray(source.filterVAO)
      // draw
      glyphFilterProgram.draw(glyphFeature, source, mode)
    }
  }

  injectGlyphImages (maxHeight: number, images: GlyphImages) {
    if (!this.programs.glyph) this.buildPrograms(new Set(['glyph']))
    const { glyph } = this.programs
    glyph.injectImages(maxHeight, images)
  }

  setColorMode (mode: 0 | 1 | 2 | 3) {
    this.dirty = true
    // tell all the programs
    const { programs } = this
    for (const programName in programs) programs[programName].updateColorBlindMode = (mode === 0)
      ? 'none'
      : (mode === 1)
        ? 'protanopia'
        : (mode === 2)
          ? 'deutranopia'
          : 'tritanopia'
  }
}

function featureSort (a: FeatureGuide, b: FeatureGuide): number {
  let diff = a.layerIndex - b.layerIndex
  if (diff) return diff
  let index = 0
  const zoomDiff = (a.parent ? 1 : 0) - (b.parent ? 1 : 0)
  if (zoomDiff) return zoomDiff
  const maxSize = Math.min(a.featureCode.length, b.featureCode.length)
  while (diff === 0 && index < maxSize) {
    diff = a.featureCode[index] - b.featureCode[index]
    index++
  }
  return diff
}

import vert1 from '../shaders/shade1.vertex.glsl'
import frag1 from '../shaders/shade1.fragment.glsl'

import vert2 from '../shaders/shade2.vertex.glsl'
import frag2 from '../shaders/shade2.fragment.glsl'

import type { Context, ShadeFeatureGuide } from '../contexts/context.spec'
import type { ShadeProgram as ShadeProgramSpec, ShadeProgramUniforms } from './program.spec'
import type { LayerDefinitionBase, LayerStyle, ShadeLayerDefinition } from 'style/style.spec'
import type { TileGL as Tile } from 'source/tile.spec'

export default async function shadeProgram (context: Context): Promise<ShadeProgramSpec> {
  const Program = await import('./program').then(m => m.default)

  class ShadeProgram extends Program implements ShadeProgramSpec {
    declare uniforms: { [key in ShadeProgramUniforms]: WebGLUniformLocation }
    constructor (context: Context) {
      // get gl from context
      const { type, devicePixelRatio } = context
      // inject Program
      super(context)
      // build shaders
      if (type === 1) this.buildShaders(vert1, frag1, { aPos: 0 })
      else this.buildShaders(vert2, frag2)
      // activate so we can setup devicePixelRatio
      this.use()
      // set pixel ratio
      this.setDevicePixelRatio(devicePixelRatio)
    }

    buildLayerDefinition (layerBase: LayerDefinitionBase, layer: LayerStyle): ShadeLayerDefinition {
      return {
        type: 'shade',
        ...layerBase
      }
    }

    // given a set of layerIndexes that use Masks and the tile of interest
    buildMaskFeature ({ layerIndex, lch, minzoom, maxzoom }: ShadeLayerDefinition, tile: Tile): void {
      const { mask, zoom } = tile
      // not in the zoom range, ignore
      if (zoom < minzoom || zoom > maxzoom) return

      const feature: ShadeFeatureGuide = {
        type: 'shade',
        maskLayer: true,
        sourceName: 'mask',
        source: mask,
        count: mask.count,
        offset: mask.offset,
        tile,
        layerIndex,
        featureCode: [0],
        layerCode: [],
        lch
      }
      tile.addFeatures([feature])
    }

    use (): void {
      // grab context & prep
      const { context } = this
      context.enableCullFace()
      context.enableDepthTest()
      context.disableStencilTest()
      context.shadeBlend()
      context.lessDepth()
      super.use()
    }

    setLayerCode (_layerCode: number[], _lch = false): void {
      // noop
    }

    draw (feature: ShadeFeatureGuide): void {
      const { gl, context } = this
      const { source, layerIndex } = feature
      const { count, offset, vao } = source
      // bind vao & draw
      context.setDepthRange(layerIndex)
      gl.bindVertexArray(vao)
      gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset * 4)
    }
  }

  return new ShadeProgram(context)
}

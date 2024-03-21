import Workflow from './workflow'

import vert1 from '../shaders/shade1.vertex.glsl'
import frag1 from '../shaders/shade1.fragment.glsl'

import vert2 from '../shaders/shade2.vertex.glsl'
import frag2 from '../shaders/shade2.fragment.glsl'

import type Context from '../context/context'
import type {
  MaskSource,
  ShadeFeature as ShadeFeatureSpec,
  ShadeWorkflow as ShadeWorkflowSpec,
  ShadeWorkflowUniforms
} from './workflow.spec'
import type {
  LayerDefinitionBase,
  ShadeDefinition,
  ShadeStyle,
  ShadeWorkflowLayerGuide
} from 'style/style.spec'
import type { TileGL as Tile } from 'source/tile.spec'

export class ShadeFeature implements ShadeFeatureSpec {
  type = 'shade' as const
  maskLayer = true
  constructor (
    public layerGuide: ShadeWorkflowLayerGuide,
    public workflow: ShadeWorkflowSpec,
    public source: MaskSource,
    public featureCode: number[],
    public tile: Tile
  ) {}

  draw (): void {
    const { tile, workflow } = this
    workflow.context.stencilFuncEqual(tile.tmpMaskID)
    workflow.draw(this)
  }

  destroy (): void {}

  duplicate (tile: Tile): ShadeFeature {
    const { layerGuide, workflow, source, featureCode } = this
    return new ShadeFeature(
      layerGuide, workflow, source, featureCode, tile
    )
  }
}

export default class ShadeWorkflow extends Workflow implements ShadeWorkflowSpec {
  declare uniforms: { [key in ShadeWorkflowUniforms]: WebGLUniformLocation }
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

  buildLayerDefinition (layerBase: LayerDefinitionBase, layer: ShadeStyle): ShadeDefinition {
    let { color } = layer
    color = color ?? 'rgb(0.6, 0.6, 0.6)'
    return {
      ...layerBase,
      type: 'shade',
      color
    }
  }

  // given a set of layerIndexes that use Masks and the tile of interest
  buildMaskFeature (layerDefinition: ShadeDefinition, tile: Tile): void {
    const { mask, zoom } = tile
    const { minzoom, maxzoom } = layerDefinition
    // not in the zoom range, ignore
    if (zoom < minzoom || zoom > maxzoom) return

    // set the layer guide
    const layerGuide: ShadeWorkflowLayerGuide = {
      ...layerDefinition,
      sourceName: 'mask',
      layerCode: [],
      interactive: false,
      opaque: false
    }

    tile.addFeatures([new ShadeFeature(layerGuide, this, mask, [0], tile)])
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

  draw (feature: ShadeFeatureSpec): void {
    const { gl, context } = this
    const { source, layerGuide: { layerIndex, visible } } = feature
    const { count, offset, vao } = source
    if (!visible) return
    // bind vao & draw
    context.setDepthRange(layerIndex)
    gl.bindVertexArray(vao)
    gl.drawElements(gl.TRIANGLE_STRIP, count, gl.UNSIGNED_INT, offset * 4)
  }
}

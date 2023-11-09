import type {
  FillLayerStyle,
  Filter,
  GlyphLayerStyle,
  Glyphs,
  HeatmapLayerStyle,
  HillshadeLayerStyle,
  LayerStyle,
  LineLayerStyle,
  NotNullOrObject,
  PointLayerStyle,
  Property,
  RasterLayerStyle,
  Sources,
  Sprites,
  StyleDefinition
} from '../s2/style/style.spec'
import type {
  BackgroundLayerSpecification,
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FillLayerSpecification,
  FilterSpecification,
  HeatmapLayerSpecification,
  HillshadeLayerSpecification,
  LayerSpecification,
  LineLayerSpecification,
  PropertyValueSpecification,
  RasterLayerSpecification,
  SourceSpecification,
  SpriteSpecification,
  StyleSpecification,
  SymbolLayerSpecification
} from '@maplibre/maplibre-gl-style-spec'

export default function styleConverter (input: StyleSpecification): StyleDefinition {
  const { center, zoom, bearing, pitch, sprite, sources } = input

  const glyphs: Glyphs = {}

  return {
    version: 1,
    center,
    zoom,
    bearing,
    pitch,
    projection: 'WM',
    glyphs,
    sources: convertSources(sources),
    sprites: sprite !== undefined ? convertSprite(sprite) : undefined,
    layers: input.layers.map(l => convertLayer(l, glyphs)).filter((l): l is LayerStyle => l !== undefined)
  }
}

function convertSources (input: Record<string, SourceSpecification>): Sources {
  const sources: Sources = {}

  for (const [name, value] of Object.entries(input)) {
    if (typeof value === 'string') {
      sources[name] = value
      continue
    }
    const { type } = value
    if (type === 'video' || type === 'image') {
      console.error(`Source type ${type} not supported`)
      continue
    }
    if (type === 'geojson') {
      const { data, maxzoom, cluster, clusterRadius, clusterMaxZoom, clusterMinPoints, clusterProperties } = value
      sources[name] = {
        path: '',
        extension: 'geojson',
        data,
        type: 'json',
        maxzoom,
        cluster,
        clusterRadius,
        clusterMaxZoom,
        clusterMinPoints,
        clusterProperties: clusterProperties as Record<string, unknown>
      }
    } else {
      const { url, tiles, minzoom, maxzoom, bounds } = value
      if (url === undefined && !Array.isArray(tiles)) throw new Error(`Source ${name} has no url`)
      const path = url ?? (Array.isArray(tiles) ? tiles[0] : '')
      sources[name] = {
        path,
        extension: path.split('.').pop() as string,
        type,
        minzoom,
        maxzoom,
        bounds,
        format: 'zxy'
      }
    }
  }

  return sources
}

function convertSprite (input: SpriteSpecification): Sprites {
  const res: Sprites = {}

  for (const sprite of input) {
    if (typeof sprite === 'string') res.default = sprite
    else res[sprite.id] = sprite.url
  }

  return res
}

// TODO: symbol, fill-extrusion
function convertLayer (layer: LayerSpecification, glyphs: Glyphs): undefined | LayerStyle {
  const { type } = layer

  if (type === 'background') return convertLayerBackground(layer)
  else if (type === 'fill') return convertLayerFill(layer)
  else if (type === 'line') return convertLayerLine(layer)
  else if (type === 'symbol') return convertLayerSymbol(layer, glyphs)
  else if (type === 'raster') return convertLayerRaster(layer)
  else if (type === 'circle') return convertLayerCircle(layer)
  // else if (type === 'fill-extrusion') return undefined
  else if (type === 'heatmap') return convertLayerHeatmap(layer)
  else if (type === 'hillshade') return convertLayerHillshade(layer)
  // else if (type === 'sky') return undefined
  else console.error(`Layer type ${type} not supported`)
}

// TODO: background-pattern
function convertLayerBackground (backgroundLayer: BackgroundLayerSpecification): FillLayerStyle {
  const { id, metadata, minzoom, maxzoom, layout = {}, paint = {} } = backgroundLayer

  return {
    name: id,
    type: 'fill',
    source: 'mask',
    metadata,
    minzoom,
    maxzoom,
    color: convertPropertyValueSpecification(paint['background-color']),
    opacity: (layout.visibility === 'none') ? 0 : convertPropertyValueSpecification(paint['background-opacity'])
  }
}

// TODO: PAINT: fill-antialias, fill-outline-color, fill-translate, fill-translate-anchor, fill-pattern
// TODO: LAYOUT: fill-sort-key
function convertLayerFill (fillLayer: FillLayerSpecification): FillLayerStyle {
  const { id, source, filter, 'source-layer': layer, metadata, minzoom, maxzoom, layout = {}, paint = {} } = fillLayer

  return {
    name: id,
    type: 'fill',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    color: convertDataDrivenPropertyValueSpecification(paint['fill-color']),
    opacity: (layout.visibility === 'none') ? 0 : convertDataDrivenPropertyValueSpecification(paint['fill-opacity'])
  }
}

// TODO: line-miter-limit, line-round-limit, line-sort-key, line-translate, line-translate-anchor, line-pattern
// TODO: line-blur, line-gradient, line-offset, line-gap-width, line-dasharray
function convertLayerLine (lineLayer: LineLayerSpecification): LineLayerStyle {
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = lineLayer

  return {
    name: id,
    type: 'line',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    color: convertDataDrivenPropertyValueSpecification(paint['line-color']),
    opacity: (layout.visibility === 'none') ? 0 : convertDataDrivenPropertyValueSpecification(paint['line-opacity']),
    width: convertDataDrivenPropertyValueSpecification(paint['line-width']),
    cap: convertPropertyValueSpecification(layout['line-cap']),
    join: convertDataDrivenPropertyValueSpecification(layout['line-join'])
    // dasharray: convertDataDrivenPropertyValueSpecification(paint['line-dasharray'])
  }
}

// TODO: raster-hue-rotate, raster-brightness-min, raster-brightness-max
function convertLayerRaster (input: RasterLayerSpecification): undefined | RasterLayerStyle {
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = input

  return {
    name: id,
    type: 'raster',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    opacity: (layout.visibility === 'none') ? 0 : convertPropertyValueSpecification(paint['raster-opacity']),
    saturation: convertPropertyValueSpecification(paint['raster-saturation']),
    contrast: convertPropertyValueSpecification(paint['raster-contrast'])
  }
}

// TODO: hillshade-illumination-anchor
function convertLayerHillshade (input?: HillshadeLayerSpecification): HillshadeLayerStyle {
  if (input === undefined) throw new Error('Hillshade layer not supported')
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = input

  return {
    name: id,
    type: 'hillshade',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    opacity: (layout.visibility === 'none') ? 0 : 1,
    illuminateDirection: convertPropertyValueSpecification(paint['hillshade-illumination-direction']),
    exaggeration: convertPropertyValueSpecification(paint['hillshade-exaggeration']),
    color: convertPropertyValueSpecification(paint['hillshade-shadow-color']),
    highlightColor: convertPropertyValueSpecification(paint['hillshade-highlight-color']),
    accentColor: convertPropertyValueSpecification(paint['hillshade-accent-color'])
  }
}

function convertLayerHeatmap (input?: HeatmapLayerSpecification): HeatmapLayerStyle {
  if (input === undefined) throw new Error('Heatmap layer not supported')
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = input

  return {
    name: id,
    type: 'heatmap',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    opacity: (layout.visibility === 'none') ? 0 : convertPropertyValueSpecification(paint['heatmap-opacity']),
    intensity: convertPropertyValueSpecification(paint['heatmap-intensity']),
    radius: convertDataDrivenPropertyValueSpecification(paint['heatmap-radius']),
    weight: convertDataDrivenPropertyValueSpecification(paint['heatmap-weight']),
    colorRamp: convertColorRamp(paint['heatmap-color'])
  }
}

// TODO: circle-sort-key, circle-blur, translate, translate-anchor
// NOTE: circle-stroke-opacity? should I implement?
function convertLayerCircle (input: CircleLayerSpecification): undefined | PointLayerStyle {
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = input

  return {
    name: id,
    type: 'point',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    opacity: (layout.visibility === 'none') ? 0 : convertDataDrivenPropertyValueSpecification(paint['circle-opacity']),
    radius: convertDataDrivenPropertyValueSpecification(paint['circle-radius']),
    color: convertDataDrivenPropertyValueSpecification(paint['circle-color']),
    stroke: convertDataDrivenPropertyValueSpecification(paint['circle-stroke-color']),
    strokeWidth: convertDataDrivenPropertyValueSpecification(paint['circle-stroke-width'])
  }
}

// TODO: opacity, MANYYYYY different properties to convert
function convertLayerSymbol (input: SymbolLayerSpecification, glyphs: Glyphs): undefined | GlyphLayerStyle {
  const {
    id,
    source,
    filter,
    'source-layer': layer,
    metadata,
    minzoom,
    maxzoom,
    layout = {},
    paint = {}
  } = input

  // TODO: May be an ExpressionSpecification
  const font = layout['text-font']
  let textFamily: string = ''
  if (Array.isArray(font) && typeof font[0] === 'string') {
    textFamily = font[0]
    const glyph: { path: string, fallback?: string } = {
      path: ''
    }
    if (font.length > 1 && typeof font[1] === 'string') glyph.fallback = font[1]
    glyphs[textFamily] = glyph
  }

  return {
    name: id,
    type: 'glyph',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    // opacity: (layout.visibility === 'none') ? 0 : convertDataDrivenPropertyValueSpecification(paint['text-opacity']),
    textFill: convertDataDrivenPropertyValueSpecification(paint['text-color']),
    textStroke: convertDataDrivenPropertyValueSpecification(paint['text-halo-color']),
    textStrokeWidth: convertDataDrivenPropertyValueSpecification(paint['text-halo-width']),
    textSize: convertDataDrivenPropertyValueSpecification(layout['text-size']),
    textFamily,
    textField: convertDataDrivenPropertyValueSpecification(layout['text-field']),
    textAlign: convertDataDrivenPropertyValueSpecification(layout['text-justify']),
    textAnchor: convertDataDrivenPropertyValueSpecification(layout['text-anchor']),
    textOffset: convertDataDrivenPropertyValueSpecification(layout['text-offset']),
    // TODO: support PaddingSpecification
    textPadding: convertDataDrivenPropertyValueSpecification(layout['text-padding']) as [number, number],
    textWordWrap: convertDataDrivenPropertyValueSpecification(layout['text-max-width']),
    // TODO: properly convert
    textKerning: convertDataDrivenPropertyValueSpecification(layout['text-letter-spacing']),
    // TODO: properly convert
    textLineHeight: convertDataDrivenPropertyValueSpecification(layout['text-line-height']),
    // icon
    iconSize: convertDataDrivenPropertyValueSpecification(layout['icon-size']),
    iconFamily: convertDataDrivenPropertyValueSpecification(layout['icon-image']),
    iconField: convertDataDrivenPropertyValueSpecification(layout['icon-field']),
    iconAnchor: convertDataDrivenPropertyValueSpecification(layout['icon-anchor']),
    iconOffset: convertDataDrivenPropertyValueSpecification(layout['icon-offset']),
    // TODO: support PaddingSpecification
    iconPadding: convertDataDrivenPropertyValueSpecification(layout['icon-padding']) as [number, number]
  }
}

// TODO:
function convertColorRamp (input?: ExpressionSpecification): undefined | Array<{ stop: number, color: string }> {
  if (input === undefined) return undefined
}

// TODO:
function convertFilter (input?: FilterSpecification): undefined | Filter {
  if (input === undefined) return undefined
}

// TODO:
function convertPropertyValueSpecification<T extends NotNullOrObject> (input?: PropertyValueSpecification<T>): undefined | Property<T> {
  if (input === undefined) return undefined
}

// TODO:
function convertDataDrivenPropertyValueSpecification<T extends NotNullOrObject> (
  input?: DataDrivenPropertyValueSpecification<T>
): undefined | Property<T> {
  if (input === undefined) return undefined
}

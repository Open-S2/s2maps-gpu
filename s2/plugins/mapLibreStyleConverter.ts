import type {
  Comparator,
  FillLayerStyle,
  Filter,
  GlyphLayerStyle,
  Glyphs,
  HeatmapLayerStyle,
  HillshadeLayerStyle,
  JSONFeatures,
  LayerStyle,
  LineLayerStyle,
  NotNullOrObject,
  PointLayerStyle,
  Property,
  RasterLayerStyle,
  SourceMetadata,
  Sources,
  Sprites,
  StyleDefinition,
  ValueType
} from 'style/style.spec'
import type {
  BackgroundLayerSpecification,
  CircleLayerSpecification,
  DataDrivenPropertyValueSpecification,
  ExpressionInputType,
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

export default function maplibreStyleConverter (input: StyleSpecification): StyleDefinition {
  const { center, zoom, bearing, pitch, sprite, sources } = input

  const glyphs: Glyphs = {}

  const res: StyleDefinition = {
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

  return res
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
      const { data, maxzoom, cluster, clusterRadius, clusterMaxZoom } = value
      sources[name] = {
        path: '',
        extension: 'geojson',
        data: data as JSONFeatures | undefined,
        type: 'json',
        maxzoom,
        cluster,
        radius: clusterRadius,
        indexMaxzoom: clusterMaxZoom
      } satisfies SourceMetadata
    } else {
      const { url, tiles, minzoom, maxzoom, bounds } = value
      if (url === undefined && !Array.isArray(tiles)) throw new Error(`Source ${name} has no url`)
      const path = url ?? (Array.isArray(tiles) ? tiles[0] : '')
      const extension = path.split('.').pop()
      if (extension === 'json' && type === 'vector') {
        // remove the 'tiles.json' from the path
        sources[name] = path.replace('tiles.json', '')
      } else {
        sources[name] = {
          path,
          extension,
          type,
          minzoom,
          maxzoom,
          bounds,
          format: 'zxy'
        }
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
    opacity: convertPropertyValueSpecification(paint['background-opacity']),
    visible: layout.visibility !== 'none'
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
    opacity: convertDataDrivenPropertyValueSpecification(paint['fill-opacity']),
    visible: layout.visibility !== 'none'
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

  const color = convertDataDrivenPropertyValueSpecification(paint['line-color'])
  const dashColor = typeof color === 'string' ? color : 'rgba(0, 0, 0, 0)'

  return {
    name: id,
    type: 'line',
    filter: convertFilter(filter),
    source,
    layer,
    metadata,
    minzoom,
    maxzoom,
    color,
    opacity: convertDataDrivenPropertyValueSpecification(paint['line-opacity']),
    width: convertDataDrivenPropertyValueSpecification(paint['line-width']),
    cap: convertPropertyValueSpecification(layout['line-cap']),
    join: convertDataDrivenPropertyValueSpecification(layout['line-join']),
    dasharray: convertDashArray(paint['line-dasharray'] ?? [], dashColor),
    visible: layout.visibility !== 'none'
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
    opacity: convertPropertyValueSpecification(paint['raster-opacity']),
    saturation: convertPropertyValueSpecification(paint['raster-saturation']),
    contrast: convertPropertyValueSpecification(paint['raster-contrast']),
    visible: layout.visibility !== 'none'
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
    azimuth: convertPropertyValueSpecification(paint['hillshade-illumination-direction']),
    // intensity: convertPropertyValueSpecification(paint['hillshade-exaggeration']),
    shadowColor: convertPropertyValueSpecification(paint['hillshade-shadow-color']),
    highlightColor: convertPropertyValueSpecification(paint['hillshade-highlight-color']),
    accentColor: convertPropertyValueSpecification(paint['hillshade-accent-color']),
    visible: layout.visibility !== 'none'
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
    opacity: convertPropertyValueSpecification(paint['heatmap-opacity']),
    intensity: convertPropertyValueSpecification(paint['heatmap-intensity']),
    radius: convertDataDrivenPropertyValueSpecification(paint['heatmap-radius']),
    weight: convertDataDrivenPropertyValueSpecification(paint['heatmap-weight']),
    colorRamp: convertColorRamp(paint['heatmap-color']),
    visible: layout.visibility !== 'none'
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
    opacity: convertDataDrivenPropertyValueSpecification(paint['circle-opacity']),
    radius: convertDataDrivenPropertyValueSpecification(paint['circle-radius']),
    color: convertDataDrivenPropertyValueSpecification(paint['circle-color']),
    stroke: convertDataDrivenPropertyValueSpecification(paint['circle-stroke-color']),
    strokeWidth: convertDataDrivenPropertyValueSpecification(paint['circle-stroke-width']),
    visible: layout.visibility !== 'none'
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
  const fonts = layout['text-font']
  let textFamily: string | string[] = ''
  if (Array.isArray(fonts) && typeof fonts[0] === 'string') {
    // if we find regular, replace with robotoRegular & notoSansRegular
    if (fonts[0].toLocaleLowerCase().includes('regular')) {
      glyphs.robotoRegular = 'apiURL://glyphs-v2/RobotoRegular'
      glyphs.NotoRegular = 'apiURL://glyphs-v2/NotoRegular'
      textFamily = ['robotoRegular', 'NotoRegular']
    } else {
      glyphs.robotoMedium = 'apiURL://glyphs-v2/RobotoMedium'
      glyphs.NotoMedium = 'apiURL://glyphs-v2/NotoMedium'
      textFamily = ['robotoMedium', 'NotoMedium']
    }
  } else {
    glyphs.robotoMedium = 'apiURL://glyphs-v2/RobotoMedium'
    textFamily = 'robotoMedium'
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
    // opacity: convertDataDrivenPropertyValueSpecification(paint['text-opacity']),
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
    iconField: convertDataDrivenPropertyValueSpecification(layout['icon-image']),
    iconAnchor: convertDataDrivenPropertyValueSpecification(layout['icon-anchor']),
    iconOffset: convertDataDrivenPropertyValueSpecification(layout['icon-offset']),
    // TODO: support PaddingSpecification
    iconPadding: convertDataDrivenPropertyValueSpecification(layout['icon-padding']) as [number, number],
    visible: layout.visibility !== 'none'
  }
}

// TODO:
function convertColorRamp (input?: ExpressionSpecification): undefined | Array<{ stop: number, color: string }> {
  if (Array.isArray(input)) {
    return undefined
  } else if (typeof input === 'object') {
    return undefined
  } else {
    return undefined
  }
}

function convertFilter (input?: FilterSpecification): undefined | Filter {
  if (Array.isArray(input)) {
    if (input.length <= 1) return undefined
    else {
      const [operator, expression] = input
      if (operator === 'all' || operator === 'any' || operator === 'none') {
        if (typeof expression === 'boolean') return undefined
        const [cmp, key, value] = expression as [Comparator, string, NotNullOrObject]
        if (cmp === '!=' || cmp === 'has' || cmp === '!has' || cmp === 'in' || cmp === '!in' || cmp === '<' || cmp === '<=' || cmp === '==' || cmp === '>' || cmp === '>=') {
          return { comparator: cmp, key, value }
        } else {
          return undefined
        }
      } else {
        return undefined
      }
    }
  } else {
    return undefined
  }
}

// TODO:
function convertPropertyValueSpecification<T extends NotNullOrObject> (input?: PropertyValueSpecification<T>): undefined | T | Property<T> {
  if (input === undefined) return undefined
  // if the input is not an object or array, it's a constant
  if (Array.isArray(input)) {
    if (input[0] === 'match') return convertPropertyValueSpecificationMatch(input)
    return undefined
  } else if (typeof input === 'object') {
    return undefined
  } else {
    return typeof input === 'string' ? replaceBrackets(input) : input
  }
}

function convertPropertyValueSpecificationMatch<T extends NotNullOrObject> (input: [
  'match',
  ExpressionInputType | ExpressionSpecification,
  ExpressionInputType | ExpressionInputType[],
  ExpressionInputType | ExpressionSpecification,
  ...Array<ExpressionInputType | ExpressionInputType[] | ExpressionSpecification>,
  // repeated as above
  ExpressionInputType | ExpressionSpecification
]): undefined | T | Property<T> {
  const [, expression, ...rest] = input
  const fallback = rest.pop()
  // @ts-expect-error - fix later
  if (expression[0] !== 'get') return undefined
  const key = expression[1]
  // we return a dataCondition
  const res: Property<T> = {
    dataCondition: {
      conditions: [],
      fallback: convertPropertyValueSpecification(fallback) as ValueType<T>
    }
  }
  for (let i = 0; i < rest.length; i += 2) {
    const value = rest[i]
    const output = rest[i + 1]
    if (value === undefined || output === undefined) return undefined
    const isArray = Array.isArray(value)
    res.dataCondition?.conditions.push({
      // @ts-expect-error - fix later
      filter: { key, comparator: isArray ? 'has' : '==', value },
      input: convertPropertyValueSpecification(output) as ValueType<T>
    })
  }

  return res
}

// TODO:
function convertDataDrivenPropertyValueSpecification<T extends NotNullOrObject> (
  input?: DataDrivenPropertyValueSpecification<T>
): undefined | T | Property<T> {
  if (Array.isArray(input)) {
    if (input[0] === 'match') return convertPropertyValueSpecificationMatch(input)
    return undefined
  } else if (typeof input === 'object') {
    if ('stops' in input) {
      if (input.type === undefined || input.type === 'interval') {
        return convertDataDrivenPropertyValueSpecificationStops(input)
      }
    }
    return undefined
  } else {
    // @ts-expect-error - fix later
    return replaceBrackets(input)
  }
}

// for now assume interval
function convertDataDrivenPropertyValueSpecificationStops<T extends NotNullOrObject> (
  input: {
    type: 'interval'
    stops: Array<[number, T]>
  } | {
    type: 'interval'
    stops: Array<[number, T]>
    property: string
    default?: T | undefined
  } | {
    type: 'interval'
    stops: Array<[{
      zoom: number
      value: number
    }, T]>
    property: string
    default?: T | undefined
  }
): undefined | T | Property<T> {
  if ('property' in input) return undefined
  if (typeof input.stops[0][0] === 'object') return undefined

  const res: Property<T> = {
    inputRange: {
      type: 'zoom',
      ranges: []
    }
  }

  for (const [zoom, value] of input.stops) {
    res.inputRange?.ranges.push({
      stop: zoom,
      // @ts-expect-error - fix later
      input: replaceBrackets(value)
    })
  }

  return res
}

// create a function that takes a string as an input
// if the input string has {word} (brackets around the word), replace it with "?word"
function replaceBrackets<T> (input: string): T {
  if (typeof input !== 'string') return input
  return input.replace(/{(\w+)}/g, '?$1') as T
}

function convertDashArray (inputDashes: PropertyValueSpecification<number[]>, color: string): Array<[number, string]> {
  const dashArray: Array<[number, string]> = []

  if (Array.isArray(inputDashes) && inputDashes.length > 0 && typeof inputDashes[0] === 'number') {
    for (let i = 0; i < inputDashes.length; i++) {
      const dashSize = inputDashes[i] * 10
      if (i % 2 === 1) dashArray.unshift([dashSize, color])
      else dashArray.unshift([dashSize, 'rgba(255, 255, 255, 0)'])
    }
  }

  return dashArray
}
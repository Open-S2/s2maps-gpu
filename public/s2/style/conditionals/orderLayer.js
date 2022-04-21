// @flow
import type { Layer } from '../styleSpec'

export default function orderLayer (layer: Layer) {
  if (layer.type === 'fill') orderFill(layer)
  else if (layer.type === 'point') orderPoint(layer)
  else if (layer.type === 'heatmap') orderHeatmap(layer)
  else if (layer.type === 'line') orderLine(layer)
  else if (layer.type === 'glyph') orderGlyph(layer)
  else if (layer.type === 'raster' || layer.type === 'sensor' || layer.type === 'raster-dem') orderRaster(layer)
}

function orderFill (layer: Layer) {
  const { paint } = layer
  layer.paint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    opacity: paint.opacity || 1
  }
}

// point order: (paint)color->radius->stroke->strokeWidth
function orderPoint (layer: Layer) {
  const { paint } = layer
  layer.paint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    radius: paint.radius || 1,
    stroke: paint.stroke || 'rgba(0, 0, 0, 0)',
    strokeWidth: paint.strokeWidth || 0,
    opacity: paint.opacity || 1
  }
}

// heatmap order: (paint)intensity->radius->opacity->(layout)->intensity
function orderHeatmap (layer: Layer) {
  const { layout, paint } = layer
  // move color ramp
  layer.colorRamp = layout['color-ramp'] || [0, '#44015400', 0.2, '#3a538bd9', 0.4, '#23898e', 0.6, '#35b779', 0.8, '#95d840', 1, '#fde725']
  // store
  layer.layoutLocal = {
    weight: layout.weight || 0.5
  }
  layer.layout = {
    intensity: layout.intensity || 1
  }
  layer.paint = {
    radius: paint.radius || 5,
    opacity: paint.opacity || 1
  }
}

// line order: (paint)color->width->dasharray->(layout)cap->join
function orderLine (layer: Layer) {
  const { paint } = layer
  // paint
  layer.paint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    width: paint.width || 1
  }
  // layount
  layer.layout = {
    cap: paint.cap || 'butt',
    join: paint.join || 'miter'
  }
}

// text order: (paint)size->strokeWidth->fill->stroke
function orderGlyph (layer: Layer) {
  const { layout, paint } = layer
  // overdraw
  if (layer.overdraw === undefined) layer.overdraw = false
  // layout & paint
  const localTextSize = (paint['text-size']) && JSON.parse(JSON.stringify(paint['text-size']))
  const localIconSize = (paint['icon-size']) && JSON.parse(JSON.stringify(paint['icon-size']))
  // store
  layer.layoutLocal = {
    // text
    'text-family': layout['text-family'] || 'default',
    'text-field': layout['text-field'],
    'text-anchor': layout['text-anchor'] || 'center',
    'text-align': layout['text-align'] || 'center',
    'text-offset': layout['text-offset'] || [0, 0],
    'text-padding': layout['text-padding'] || [0, 0],
    'text-word-wrap': layout['text-word-wrap'] || 6,
    'text-kerning': layout['text-kerning'] || 0,
    'text-line-height': layout['text-line-height'] || 0.1,
    // icon
    'icon-family': layout['icon-family'] || 'default',
    'icon-field': layout['icon-field'],
    'icon-anchor': layout['icon-anchor'] || 'center',
    'icon-offset': layout['icon-offset'] || [0, 0],
    'icon-padding': layout['icon-padding'] || [0, 0]
  }
  layer.paintLocal = {}
  // text
  if (localTextSize) layer.paintLocal['text-size'] = localTextSize
  // icon
  if (localIconSize) layer.paintLocal['icon-size'] = localIconSize
  layer.layout = {}
  // text paint
  layer.paint = {
    'text-size': paint['text-size'] || 42,
    'text-fill': paint['text-fill'] || 'rgba(0, 0, 0, 0)',
    'text-stroke-width': paint['text-stroke-width'] || 0,
    'text-stroke': paint['text-stroke'] || 'rgba(0, 0, 0, 0)',
    'icon-size': paint['icon-size'] || 16
  }
  // icon paint
  layer.iconPaint = {
    'icon-size': (paint['icon-size']) ? JSON.parse(JSON.stringify(paint['icon-size'])) : 16
  }
}

// order: (paint)opacity
function orderRaster (layer: Layer) {
  // grab variables
  const { type, layout, paint } = layer
  // move color ramp
  if (type === 'sensor') layer.colorRamp = layout['color-ramp'] || [0, '#44015400', 0.2, '#3a538bd9', 0.4, '#23898e', 0.6, '#35b779', 0.8, '#95d840', 1, '#fde725']
  // store
  layer.paint = {
    opacity: paint.opacity || 1
  }
  layer.layout = {}
}
// @flow
import type { Layer } from '../styleSpec'

export default function orderLayer (layer: Layer) {
  if (layer.type === 'fill') orderFill(layer)
  else if (layer.type === 'point') orderPoint(layer)
  else if (layer.type === 'heatmap') orderHeatmap(layer)
  else if (layer.type === 'line' || layer.type === 'line3D') orderLine(layer)
  else if (layer.type === 'glyph') orderText(layer)
  else if (layer.type === 'billboard') orderBillboard(layer)
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
  layer.colorRamp = layout['color-ramp'] || [0, "rgba(68, 1, 84, 0)",0.2,"rgba(58, 83, 139, 0.85)",0.4,"#23898e",0.6,"#35b779",0.8,"#95d840",1,"#fde725"]
  // store
  layer.layoutLocal = {
    weight: layout.weight || 0.5
  }
  layer.layout = {
    intensity: layout.intensity || 1
  }
  layer.paint = {
    radius: paint.radius || 5,
    opacity: paint.opacity || 1,
  }
}

// line order: (paint)color->width->dasharray->(layout)cap->join
function orderLine (layer: Layer) {
  const { paint } = layer
  // store
  layer.paint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    width: paint.width || 1
  }
}

// text order: (paint)size->strokeWidth->fill->stroke
function orderText (layer: Layer) {
  const { layout, paint } = layer
  const localSize = JSON.parse(JSON.stringify(paint.size))
  // store
  layer.layoutLocal = {
    family: layout.family || 'default',
    field: layout.field || '',
    anchor: layout.anchor || 'center',
    padding: layout.padding || [0, 0],
    offset: layout.offset || [0, 0]
  }
  layer.paintLocal = {
    size: localSize || 16
  }
  layer.layout = {}
  layer.paint = {
    size: paint.size || 16,
    strokeWidth: paint.strokeWidth || 0,
    fill: paint.fill || 'rgba(0, 0, 0, 0)',
    stroke: paint.stroke || 'rgba(0, 0, 0, 0)'
  }
}

// line order: (paint)size->color->(layout)anchor->padding->offset
function orderBillboard (layer: Layer) {
  const { layout, paint } = layer
  // store
  layer.layout = {
    field: layout.field,
    offset: layout.offset,
    padding: layout.padding
  }
  layer.paint = {
    size: paint.size,
    opacity: paint.opacity
  }
}

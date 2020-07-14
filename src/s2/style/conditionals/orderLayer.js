// @flow
import type { Layer } from '../styleSpec'

export default function orderLayer (layer: Layer) {
  if (layer.type === 'fill' && !layer.color) layer.color = 'rgba(0, 0, 0, 0)'
  else if (layer.type === 'line' || layer.type === 'line3D') orderLine(layer)
  else if (layer.type === 'text') orderText(layer)
  else if (layer.type === 'billboard') orderBillboard(layer)
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

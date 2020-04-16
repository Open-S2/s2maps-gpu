// @flow
import type { Layer } from '../styleSpec'

export default function orderLayer (layer: Layer) {
  if (layer.type === 'fill' && !layer.color) layer.color = 'rgba(0, 0, 0, 0)'
  else if (layer.type === 'line' || layer.type === 'line3D') orderLine(layer)
  else if (layer.type === 'text') orderText(layer)
  else if (layer.type === 'billboard') orderBillboard(layer)
}

// line order: (layout)cap->join->(paint)color->width->dasharray->gapwidth->blur
function orderLine (layer: Layer) {
  const { paint } = layer
  const newLinePaint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    width: paint.width || 1
  }
  layer.paint = newLinePaint
}

// line order: (layout)family->field->offset->padding->(paint)size->fillStyle->strokeStyle->strokeWidth
function orderText (layer: Layer) {
  const { layout, paint } = layer
  const newtextLayout = {
    family: layout.family || '-apple-system, Roboto, Arial, sans-serif',
    field: layout.field || '',
    anchor: layout.anchor || 'center',
    offset: layout.offset || [0, 0],
    padding: layout.padding || [2, 2]
  }
  const newTextPaint = {
    size: paint.size || 16,
    fillStyle: paint.fillStyle || paint.color || 'rgba(0, 0, 0, 0)',
    strokeStyle: paint.strokeStyle,
    strokeWidth: paint.strokeWidth || 1
  }
  layer.layout = newtextLayout
  layer.paint = newTextPaint
}

// line order: (layout)field->offset->padding->(paint)size->opacity
function orderBillboard (layer: Layer) {
  const { layout, paint } = layer
  const newBillboardLayout = {
    field: layout.field,
    offset: layout.offset,
    padding: layout.padding
  }
  const newBillboardPaint = {
    size: paint.size,
    opacity: paint.opacity
  }
  layer.layout = newBillboardLayout
  layer.paint = newBillboardPaint
}

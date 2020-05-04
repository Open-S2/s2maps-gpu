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
  const newLinePaint = {
    color: paint.color || 'rgba(0, 0, 0, 0)',
    width: paint.width || 1
  }
  layer.paint = newLinePaint
}

// text order: (paint)size->color->strokeWidth->(layout)anchor->padding->offset
// text is unique:
// 1) minimum padding of 2
// 2) join fill and stroke into a color
// 3) since we are joining stroke and fill, the "inner-offset" of fill must be added by strokeWidth
//    and the stroke size must always be 2 * strokeWidth + size
function orderText (layer: Layer) {
  const { layout, paint } = layer
  // build out according to cpu and gpu
  const newTextLayoutLocal = {
    family: layout.family || 'default',
    field: layout.field || '',
    anchor: layout.anchor || 'center',
    padding: layout.padding || [0, 0],
    offset: layout.offset || [0, 0]
  }
  const newTextPaintLocal = {
    size: paint.size || 16,
    fill: paint.fill || 'rgba(0, 0, 0, 0)',
    stroke: paint.stroke || 'rgba(0, 0, 0, 0)',
    strokeWidth: paint.strokeWidth || 0
  }
  // store
  layer.layoutLocal = newTextLayoutLocal
  layer.paintLocal = newTextPaintLocal
  layer.layout = {}
  layer.paint = {}
}

// line order: (paint)size->color->(layout)anchor->padding->offset
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

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

// text order: (paint)size->strokeWidth->fill->stroke->(layout)padding->offset
// function orderText (layer: Layer) {
//   const { layout, paint } = layer
//   const localLayout = JSON.parse(JSON.stringify(layout))
//   const localPaint = JSON.parse(JSON.stringify(paint))
//   // store
//   layer.layoutLocal = {
//     family: localLayout.family || 'default',
//     field: localLayout.field || '',
//     anchor: localLayout.anchor || 'center',
//     padding: localLayout.padding || [0, 0],
//     offset: localLayout.offset || [0, 0]
//   }
//   layer.paintLocal = {
//     size: localPaint.size || 16,
//     fill: localPaint.fill || 'rgba(0, 0, 0, 0)',
//     stroke: localPaint.stroke || 'rgba(0, 0, 0, 0)',
//     strokeWidth: localPaint.strokeWidth || 0
//   }
//   layer.layout = {
//     padding: layout.padding || [0, 0],
//     offset: layout.offset || [0, 0]
//   }
//   layer.paint = {
//     size: paint.size || 16,
//     strokeWidth: paint.strokeWidth || 0,
//     fill: paint.fill || 'rgba(0, 0, 0, 0)',
//     stroke: paint.stroke || 'rgba(0, 0, 0, 0)'
//   }
// }
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

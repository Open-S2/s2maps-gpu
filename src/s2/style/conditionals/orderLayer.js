// @flow
import type { Layer } from '../styleSpec'

export default function orderLayer (layer: Layer) {
  if (layer.type === 'line' || layer.type === 'line3D') orderLine(layer)
  else if (layer.type === 'text') orderText(layer)
  else if (layer.type === 'billboard') orderBillboard(layer)
}

// line order: (layout)cap->join->(paint)color->width->dasharray->gapwidth->blur
// TODO: set layer.maxWidth appropriately
function orderLine (layer: Layer) {
  const { paint } = layer
  const newLinePaint = {
    color: paint.color,
    width: paint.width,
    dasharray: paint.dasharray,
    gapwidth: paint.gapwidth,
    blur: paint.blur
  }
  // find maxWidth
  if (Array.isArray(paint.width)) {
    layer.maxWidth = 1
  } else {
    layer.maxWidth = paint.width
  }
  layer.paint = newLinePaint
}

// line order: (layout)family->field->offset->padding->(paint)color->size->halowidth->halocolor
function orderText (layer: Layer) {
  const { layout, paint } = layer
  const newtextLayout = {
    family: layout.family,
    field: layout.field,
    offset: layout.offset,
    padding: layout.padding
  }
  const newTextPaint = {
    family: paint.family,
    field: paint.field,
    offset: paint.offset,
    padding: paint.padding,
    color: paint.color,
    size: paint.size,
    halowidth: paint.halowidth,
    halocolor: paint.halocolor
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

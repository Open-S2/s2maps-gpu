// @flow
import { texturePack } from './'
import mapOverlap from './mapOverlap'

import type { Text } from '../workers/tile.worker'

export type Canvas = {
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D
}

export default class TextureBuilder {
  offscreen: boolean
  canvas: HTMLCanvasElement
  context: CanvasRenderingContext2D
  constructor (offscreen?: boolean = false) {
    this.offscreen = offscreen
    this.canvas = (offscreen) ? new OffscreenCanvas(1, 1) : document.createElement('canvas')
    this.context = this.canvas.getContext('2d')
    // turn of smoothing
    this.context.imageSmoothingEnabled = false
    this.context.mozImageSmoothingEnabled = false
  }

  // https://stackoverflow.com/questions/40066166/canvas-text-rendering-blurry
  createTexture (texts: Array<Text>): ImageBitmap {
    // define the width & height parameters
    for (const text of texts) {
      // prep the fontDefinition to get the proper width
      this.context.font = `${text.size}px ${text.family}`
      // build out the width and height
      text.width = Math.ceil(this.context.measureText(text.field).width + ((text.padding[0] + text.strokeWidth) * 2))
      text.height = text.size + text.padding[1]
    }
    // filter obvious overlaps
    texts = mapOverlap(texts, 512).filter(t => !t.overlap) // 768 is the average between 512 and 1024, balance of performance and population of information
    // add's the x and y parameters to each text while also resolving the necessary texture size
    const { width, height } = texturePack(texts)

    return [texts, this._createTexture(width, height, texts)]
  }

  _createTexture (width: number, height: number, texts: Array<any>): ImageBitmap {
    // build the total size to house all the text
    this.canvas.width = width * 2
    this.canvas.height = height * 2
    // clear canvas
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height)
    // prep consistant context variables
    this.context.textBaseline = 'middle'
    this.context.scale(2, -2)
    this.context.translate(0, -height)

    for (const text of texts) {
      // prep variables
      const middle = text.size / 2
      // describe font for proper width
      this.context.font = `${text.size}px ${text.family}`
      // this.context.font = `${text.size}px ${text.family}, -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif`
      // set color
      this.context.fillStyle = text.fillStyle
      this.context.strokeStyle = text.strokeStyle
      this.context.lineWidth = text.strokeWidth
      // draw
      this.context.strokeText(text.field, text.x + (text.padding[0] / 2) + text.strokeWidth, middle + text.y + (text.padding[1] / 2) + text.strokeWidth)
      this.context.fillText(text.field, text.x + (text.padding[0] / 2) + text.strokeWidth, middle + text.y + (text.padding[1] / 2) + text.strokeWidth)
    }

    if (this.offscreen) return this.canvas.transferToImageBitmap()
    else return this.canvas
  }
}

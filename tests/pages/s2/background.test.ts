import { expect, test } from 'vitest'
import { createCanvas } from 'node-canvas-webgl'
import { S2Map } from '../../../s2'

test('Background renders', async () => {
  global.window = globalThis.window = {
    // @ts-expect-error - support NodeJS
    navigator: {
      hardwareConcurrency: 4
    }
  }

  const map = new S2Map({
    canvas: createCanvas(100, 100) as HTMLCanvasElement,
    style: {}
    // offscreen: false
  })
  expect(map).toBeDefined()
})

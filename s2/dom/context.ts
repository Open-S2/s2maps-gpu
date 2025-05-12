import type { GlyphImages } from 'workers/source/glyphSource.js';
import type { MapOptions } from 'ui/s2mapUI.js';
import type { Painter } from './painter.spec.js';
import type { SpriteImageMessage } from 'workers/worker.spec.js';
import type { TileDOM as Tile } from 'source/tile.spec.js';
import type { ColorArray, GPUType, Projection } from 'style/style.spec.js';
import type { TileMaskSource, Workflow } from './workflows/workflow.spec.js';

/** Context presentation */
export interface ContextPresentation {
  width: number;
  height: number;
}

/**
 * # Context
 *
 * ## Description
 * A DOM Rendering context.
 * A useful wrapper to store state and reduce costly CPU calls when unnecessary
 */
export class DOMContext {
  type: GPUType = 0;
  painter: Painter;
  interactive = false;
  renderer = 'DOM';
  projection: Projection = 'S2';
  presentation: ContextPresentation = { width: 0, height: 0 };
  currWorkflow: undefined | Workflow = undefined;
  clearColorRGBA: ColorArray = [0, 0, 0, 0];
  devicePixelRatio: number;
  #canvasContainer: HTMLElement;

  /**
   * @param canvas - The canvas to render to
   * @param options - Map options
   * @param painter - The painter that will use this context to manage rendering state
   */
  constructor(
    private readonly canvas: HTMLCanvasElement,
    options: MapOptions,
    painter: Painter,
  ) {
    const { canvasMultiplier } = options;
    this.painter = painter;
    this.devicePixelRatio = canvasMultiplier ?? 1;
    this.#canvasContainer = canvas.parentElement as HTMLElement;
    console.info(this.#canvasContainer);
  }

  /** Resize the size of the canvas and all associating buffers */
  resize(): void {
    const { width, height } = this.canvas.getBoundingClientRect();
    this.presentation = { width, height };
  }

  /**
   * Set the interactive mode
   * @param interactive - the interactive mode (true means it is interactive)
   */
  setInteractive(interactive: boolean): void {
    this.interactive = interactive;
  }

  /**
   * Set the projection type (S2 or WM)
   * @param projection - the projection
   */
  setProjection(projection: Projection): void {
    if (projection === 'S2') throw new Error('S2 not supported');
    this.projection = projection;
  }

  /**
   * Set a clear color
   * @param clearColor - the clear color
   */
  setClearColor(clearColor: ColorArray): void {
    this.clearColorRGBA = clearColor;
  }

  /**
   * Get the mask for a tile
   * the zoom determines the number of divisions necessary to maintain a visually
   * asthetic spherical shape. As we zoom in, the tiles are practically flat,
   * so division is less useful.
   * 0, 1 => 16  ;  2, 3 => 8  ;  4, 5 => 4  ;  6, 7 => 2  ;  8+ => 1
   * context stores masks so we don't keep recreating them and put excess stress and memory on the GPU
   * @param _division - number of division to slice the geometry by
   * @param tile - the tile to create the mask for
   * @returns the mask
   */
  getMask(_division: number, tile: Tile): TileMaskSource {
    return {
      tile,
      container: this.canvas,
      /** Draw the mask */
      draw: () => {},
      /** Destroy the mask */
      destroy: () => {},
    };
  }

  /**
   * Get the collection of features found at the mouse position
   * @param _x - x mouse position
   * @param _y - y mouse position
   * @returns the collection of features found
   */
  async getFeatureAtMousePosition(_x: number, _y: number): Promise<number[]> {
    return await [];
  }

  /* PREP PHASE */

  /** Reset the viewport */
  resetViewport(): void {
    // const { gl } = this;
    // gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
  }

  /** Reset the current workflow */
  resetWorkflow(): void {
    this.currWorkflow = undefined;
  }

  /**
   * Set the current workflow
   * @param workflow - the workflow to set as the current
   * @param use - flag to say we want to also activate the workflow
   */
  setWorkflow(workflow: Workflow, use = true): void {
    if (this.currWorkflow?.label === workflow.label) return;
    if (use) workflow?.use();
    this.currWorkflow = workflow;
  }

  /* MANAGE IMAGE IMPORTS */

  /**
   * Inject a glyph/icon image to the GPU
   * @param _maxHeight - the maximum height of the texture required to hold the image
   * @param _images - the glyph/icon images
   */
  injectImages(_maxHeight: number, _images: GlyphImages): void {}

  /**
   * Inject a sprite image to the GPU
   * @param _data - the raw image data of the sprite
   */
  injectSpriteImage(_data: SpriteImageMessage): void {}

  /* TEXTURE */

  /**
   * Build a new texture
   * @param imageData - the raw image data to inject to the texture
   * @param width - width of the texture
   * @param height - height of the texture
   * @returns the image element
   */
  buildTexture(
    imageData: null | ArrayBufferView | ImageBitmap,
    width: number,
    height: number = width,
  ): HTMLImageElement {
    const imgElement = document.createElement('img');
    if (imageData === null) throw new Error('Failed to create image element');

    imgElement.width = width;
    imgElement.height = height;

    if (imageData instanceof ImageBitmap) {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx === null) throw new Error('Could not get canvas context');
      ctx.drawImage(imageData, 0, 0);
      canvas.toBlob((blob) => {
        if (blob === null) throw new Error('Blob creation failed');
        imgElement.src = URL.createObjectURL(blob);
      });
    } else {
      imgElement.src = URL.createObjectURL(new Blob([imageData]));
    }

    return imgElement;
  }

  /* CLEANUP */

  /** At the end of rendering a frame/scene, call this function to cleanup the state */
  finish(): void {}

  /** Delete/cleanup the context */
  delete(): void {
    // this.canvas.width = 1;
    // this.canvas.height = 1;
  }
}

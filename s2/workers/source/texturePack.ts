/** Local Texture Pack bounding box */
type BBox = [x: number, y: number, width: number, height: number]; // x, y, width, height
/** Local Texture Pack area tracker */
interface Space {
  widthOffset: number;
  heightOffset: number;
}

/**
 * Texture pack stores fonts and builds out SDF characters onto a texture sheet
 * each time we encounter a new character, we need to build the fills and strokes
 * and let the main painting thread know about the update
 * each font will have its own vertical row, and if a row is filled, we start a new one
 * the horizontal space is 2048 and we start a new row
 */
export default class TexturePack {
  height = 0;
  maxWidth = 2048;
  spaces: Record<number, Space> = {};

  /**
   * Add a glyph
   * @param width - width of glyph
   * @param height - height of glyph
   * @returns the position of the glyph in the texture
   */
  addGlyph(width: number, height: number): [offsetX: number, offsetY: number] {
    // create a box object
    const bbox: BBox = [0, 0, width, height];

    // if spaces doesn't have the height OR the width of the space is maxed out, create new
    if (
      this.spaces[height] === undefined ||
      this.spaces[height].widthOffset + width > this.maxWidth
    ) {
      this.spaces[height] = { heightOffset: this.height + 1, widthOffset: 0 };
      // update height offset of texture
      this.height += height + 1;
    }

    // add to the space
    const { widthOffset, heightOffset } = this.spaces[height];
    bbox[0] = widthOffset;
    bbox[1] = heightOffset;
    // update width offset of row
    this.spaces[height].widthOffset += width + 1;

    // return the textures position
    return [bbox[0], bbox[1]];
  }
}

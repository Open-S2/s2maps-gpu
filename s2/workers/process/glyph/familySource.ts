import type { ColorArray } from 'style/color';
import type { ImageMetadata, ImageSourceMetadata } from 'workers/source/imageSource';

/** A Glyph Container. Tracks all the glyph's properties, shape, size, etc. */
export interface Glyph {
  /** code represents either the unicode value or substitution value */
  code: string;
  /** texX is the x position on the texture sheet */
  texX: number;
  /** texY is the y position on the texture sheet */
  texY: number;
  /** texW is the width of the glyph on the texture sheet */
  texW: number;
  /** texH is the height of the glyph on the texture sheet */
  texH: number;
  /** xOffset is the x offset for the glyph */
  xOffset: number;
  /** yOffset is the y offset for the glyph */
  yOffset: number;
  /** width is the width of the glyph */
  width: number;
  /** height is the height of the glyph */
  height: number;
  /** advanceWidth is how far to move the cursor */
  advanceWidth: number;
}

/** An Icon's id/name and it's associative color */
export interface IconPiece {
  /** glyphID is the glyphID of the icon */
  glyphID: string;
  /** colorID is the colorID of the icon */
  color: ColorArray;
}
/** List of IconPieces */
export type Icon = IconPiece[];

/** Ligature Substitution Tree Node */
export interface LigatureSubstitute {
  type: 4;
  substitute: string;
  components: string[];
}
/** Ligature Substitution Tree */
export interface LigatureTree extends Record<number, LigatureTree> {
  /** unicode substitute if it ends here */
  substitute?: string;
}
/** Icon's name id and color id, whereas an `IconPiece`, the color is mapped */
export interface IconDefinition {
  glyphID: string;
  colorID: number;
}
/** Map of icons to their collection of images that make them up */
export type IconMap = Record<string, IconDefinition[]>; // ex: ['airport']: [0, 1, 2, 5, 7] (name maps reference a list of unicodes)
/** Set of unicodes that are part of the family */
export type GlyphSet = Set<string>;
/** Map of IDs to RGBA colors */
export type ColorMap = Record<number, ColorArray>;

/**
 * # Family Source
 *
 * Maintain a store of the Font/Icon family, it's glyphs, ligatures, icons, and colors associated
 * with it. Make requests to the source worker for missing glyphs.
 */
export default class FamilySource {
  name: string;
  extent: number = 0;
  defaultAdvance: number = 0;
  glyphSet: GlyphSet = new Set(); // existing glyphs
  ligatures: LigatureTree = {};
  // cache system
  glyphCache = new Map<string, Glyph>(); // glyphs we have built already
  iconCache = new Map<string, Icon>();
  // track missing glyphs for future requests to the source worker
  glyphRequestList = new Map<bigint, Set<string>>();
  isIcon = false;
  /**
   * @param name - the name of the family
   * @param metadata - the raw metadata to unpack
   */
  constructor(name: string, metadata?: ArrayBuffer) {
    this.name = name;
    if (metadata === undefined) return;
    const meta = new DataView(metadata);
    this.extent = meta.getUint16(0, true);
    this.defaultAdvance = meta.getUint16(8, true) / this.extent;
    const glyphCount = meta.getUint16(10, true);
    const iconMapSize = meta.getUint32(12, true);
    const colorBufSize = meta.getUint16(16, true) * 4;
    const substituteSize = meta.getUint32(18, true);
    this.isIcon = iconMapSize > 0;

    // store glyphSet
    const glyphEnd = 30 + glyphCount * 2;
    const gmdv = new DataView(metadata, 30, glyphCount * 2);
    for (let i = 0; i < glyphCount; i++) {
      this.glyphSet.add(String(gmdv.getUint16(i * 2, true)));
    }
    // build icon metadata
    const iconMap = this.#buildIconMap(iconMapSize, new DataView(metadata, glyphEnd, iconMapSize));
    const colors = this.#buildColorMap(
      colorBufSize,
      new DataView(metadata, glyphEnd + iconMapSize, colorBufSize),
    );
    // store the icon
    for (const [name, pieces] of Object.entries(iconMap)) {
      this.iconCache.set(
        name,
        pieces.map((piece) => {
          return { glyphID: piece.glyphID, color: colors[piece.colorID] };
        }),
      );
    }
    this.#buildSubstituteMap(
      substituteSize,
      new DataView(metadata, glyphEnd + iconMapSize + colorBufSize, substituteSize),
    );

    // store space (32)
    if (!this.isIcon)
      this.glyphCache.set('32', {
        code: '32',
        texX: 0,
        texY: 0,
        texW: 0,
        texH: 0,
        xOffset: 0,
        yOffset: 0,
        width: 0,
        height: 0,
        advanceWidth: this.defaultAdvance,
      });
  }

  /**
   * Given an image metadata input, build a FamilySource
   * @param imageSource - the image metadata
   * @returns a new FamilySource
   */
  static FromImageMetadata(imageSource: ImageSourceMetadata): FamilySource {
    const { name, metadata } = imageSource;
    const fs = new FamilySource(name);
    fs.addMetadata(metadata);
    return fs;
  }

  /**
   * Check if the Family Source has an existing glyph/icon
   * @param code - glyph code
   * @returns true if the glyph/icon exists
   */
  has(code: string): boolean {
    return this.glyphSet.has(code);
  }

  /**
   * Check if this source is missing a glyph/icon
   * @param code - the code of the glyph/icon
   * @returns true if the glyph/icon is missing
   */
  missingGlyph(code: string): boolean {
    const { isIcon, glyphSet, glyphCache } = this;
    if (isIcon) return !glyphCache.has(code);
    return glyphSet.has(code) && !glyphCache.has(code);
  }

  /**
   * Add image metadata to the source
   * @param metadata - the image metadata
   */
  addMetadata(metadata: ImageMetadata): void {
    for (const [code, glyph] of Object.entries(metadata)) {
      this.glyphSet.add(code);
      this.glyphCache.set(code, glyph);
      if (!this.iconCache.has(code))
        this.iconCache.set(code, [{ glyphID: code, color: [0, 0, 0, 0] }]);
    }
  }

  /**
   * Add a glyph request to be processed
   * @param tileID - the id of the tile that requested the glyph
   * @param code - the code of the glyph/icon
   */
  addGlyphRequest(tileID: bigint, code: string): void {
    if (!this.glyphRequestList.has(tileID)) this.glyphRequestList.set(tileID, new Set());
    const requests = this.glyphRequestList.get(tileID);
    requests?.add(code);
  }

  /**
   * Get the glyph requests for a tile
   * @param tileID - the id of the tile that requested the glyph/icon
   * @returns the list of glyph/icon requests
   */
  getRequests(tileID: bigint): string[] {
    const glyphList = this.glyphRequestList.get(tileID) ?? new Set<string>();
    // cleanup requests that we are pulling from the cache
    this.glyphRequestList.delete(tileID);

    return [...glyphList];
  }

  /**
   * Build a collection of icons and their associated glyphs & colors
   * @param iconMapSize - the size of the icon map
   * @param dv - the data view to read from
   * @returns the icon map
   */
  #buildIconMap(iconMapSize: number, dv: DataView): IconMap {
    const iconMap: IconMap = {};
    let pos = 0;
    while (pos < iconMapSize) {
      const nameLength = dv.getUint8(pos);
      const mapLength = dv.getUint8(pos + 1);
      pos += 2;
      const id: number[] = [];
      for (let i = 0; i < nameLength; i++) id.push(dv.getUint8(pos + i));
      const name = id.map((n) => String.fromCharCode(n)).join('');
      pos += nameLength;
      const map: IconDefinition[] = [];
      for (let i = 0; i < mapLength; i++) {
        map.push({
          glyphID: String(dv.getUint16(pos, true)),
          colorID: dv.getUint16(pos + 2, true),
        });
        pos += 4;
      }
      iconMap[name] = map;
    }

    return iconMap;
  }

  /**
   * Build a collection of colors
   * @param colorSize - the size of the color map
   * @param dv - the data view to read from
   * @returns the color map
   */
  #buildColorMap(colorSize: number, dv: DataView): ColorArray[] {
    const colors: ColorArray[] = [];
    for (let i = 0; i < colorSize; i += 4) {
      colors.push([dv.getUint8(i), dv.getUint8(i + 1), dv.getUint8(i + 2), dv.getUint8(i + 3)]);
    }

    return colors;
  }

  /**
   * Build a collection of ligature substitutions
   * @param substituteSize - the size of the ligature map
   * @param dv - the data view to read from
   */
  #buildSubstituteMap(substituteSize: number, dv: DataView): void {
    let pos = 0;
    while (pos < substituteSize) {
      const type = dv.getUint8(pos);
      if (type === 4) {
        // LIGATURE TYPE
        const count = dv.getUint8(pos + 1);
        const components: string[] = [];
        for (let j = 0; j < count; j++) {
          components.push(String(dv.getUint16(pos + 2 + j * 2, true)));
        }
        const substitute = components.join('.');
        this.glyphSet.add(substitute);
        let tree = this.ligatures;
        for (const component of components) {
          const unicode = Number(component);
          if (tree[unicode] === undefined) tree[unicode] = {};
          tree = tree[unicode];
        }
        tree.substitute = substitute;
        pos += 2 + count * 2;
      } else {
        throw new Error(`Unknown substitute type: ${type}`);
      }
    }
  }

  /**
   * Zero Width Joiner pass goes first
   * @param strCodes - array of codes to parse
   * @param zwjPass - true if we are in the zero width joiner pass
   */
  parseLigatures(strCodes: string[], zwjPass = false): void {
    // iterate through the unicodes and follow the tree, if we find a substitute,
    // replace the unicodes with the substitute, but don't stop diving down the tree until we don't find
    // a substitute. This is because we want to find the longest ligature match possible.
    for (let i = 0; i < strCodes.length; i++) {
      let code = Number(strCodes[i]);
      let tree = this.ligatures;
      let j = i;
      let zwj = false;
      while (tree[code] !== undefined) {
        if (code === 8205) zwj = true;
        tree = tree[code];
        if (tree.substitute !== undefined && (zwjPass ? zwj : true)) {
          strCodes.splice(i, j - i + 1, tree.substitute);
        } else {
          j++;
        }
        code = Number(strCodes[j]);
      }
    }
  }
}

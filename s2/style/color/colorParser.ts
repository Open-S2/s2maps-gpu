import type { ColorArray } from './index.js';

/** ColorDefinition - [encoding, colors] */
export type ColorDefinition = [encoding: string, colors: ColorArray];

// there are three types of strings to parse
// color names: 'red', 'black', etc
// Hex: #ededed
// type encodings:
// rgb(255, 255, 255)
// rgba(255, 255, 255, 255)
// hsv(180, 0.9, 0.7843137254901961)
// hsva(180, 0.9, 0.7843137254901961, 1)

const COLOR_MAP = {
  aqua: 0x00ffff,
  black: 0x000000,
  blue: 0x0000ff,
  fuchsia: 0xff00ff,
  gray: 0x808080,
  green: 0x008000,
  lime: 0x00ff00,
  maroon: 0x800000,
  navy: 0x000080,
  olive: 0x808000,
  orange: 0xffa500,
  purple: 0x800080,
  red: 0xff0000,
  silver: 0xc0c0c0,
  teal: 0x008080,
  white: 0xffffff,
  yellow: 0xffff00,
};

/**
 * There are four types of strings to parse:
 * - color names: 'red', 'black', etc
 * - Hex: #ededed
 * - lastly type encodings:
 * - * rgb(255, 255, 255)
 * - * rgba(255, 255, 255, 255)
 * - * hsv(180, 0.9, 0.7843137254901961)
 * - * hsva(180, 0.9, 0.7843137254901961, 1)
 * @param input - the string to parse
 * @returns the parsed color
 */
export function colorParser(input: string): ColorDefinition {
  if (COLOR_MAP[input as keyof typeof COLOR_MAP] !== undefined) {
    const u = COLOR_MAP[input as keyof typeof COLOR_MAP];
    const r = u >> 16;
    const g = (u >> 8) & 0xff;
    const b = u & 0xff;
    return ['rgb', [r, g, b, 1]];
  } else if (input[0] === '#') {
    // hex encoding
    return parseHex(input);
  } else {
    return parseString(input);
  }
}

/**
 * Parse a hex string
 * @param input - the string to parse
 * @returns the parsed color
 */
function parseHex(input: string): ColorDefinition {
  input = input.substring(1);
  // shorthand notation
  if (input.length % 3 === 0) {
    if (input.length === 3) {
      const sub = input.split('');
      input = sub[0] + sub[0] + sub[1] + sub[1] + sub[2] + sub[2];
    }
    const u = parseInt(input, 16);
    const r = u >> 16;
    const g = (u >> 8) & 0xff;
    const b = u & 0xff;
    return ['rgb', [r, g, b, 1]];
  } else if (input.length % 4 === 0) {
    if (input.length === 4) {
      const sub = input.split('');
      input = sub[0] + sub[0] + sub[1] + sub[1] + sub[2] + sub[2] + sub[3] + sub[3];
    }
    const u = parseInt(input, 16);
    const r = (u >> 24) & 0xff;
    const g = (u >> 16) & 0xff;
    const b = (u >> 8) & 0xff;
    const a = Math.round(((u & 0xff) / 0xff) * 100) / 100;
    return ['rgb', [r, g, b, a]];
  } else {
    return ['rgb', [0, 0, 0, 0]];
  }
}

/**
 * Parse a type encoding into a color
 * @param input - the string to parse
 * @returns the parsed color
 */
function parseString(input: string): ColorDefinition {
  // seperate type and values
  let [type, values] = input.split('(');
  // cleanup values & parse numbers
  const nums = values.split(')')[0].split(',').map(Number);
  // if no alpha type present, add alpha number
  if (type.length === 3) {
    nums.push(1);
  } else {
    // remove extra character for Color class
    type = type.slice(0, -1);
    // ensure the alpha value is between 0 and 1
    if (nums[3] > 1) nums[3] /= 255;
  }
  return [type, [nums[0] ?? 0, nums[1] ?? 0, nums[2] ?? 0, nums[3] ?? 0]];
}

import parse from './parse.ts';

/**
 * Parse a WGSL file
 * @param source - location of the WGSL file
 * @returns - the parsed object
 */
export default function (source: string): string {
  // @refresh reset
  // @ts-expect-error - let the plugin do its thing
  return parse(this.resource, source);
}

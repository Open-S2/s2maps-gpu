/**
 * # URL Map
 *
 * A convenient way to define scheme/protocol of the URL and it's replacement.
 * This can be defined by the user in the {@link MapOptions} `urlMap` property.
 *
 * The default replacement key-values are:
 * - s2maps: 'https://api.s2maps.com'
 * - opens2: 'https://api.opens2.com'
 * - mapbox: 'https://api.mapbox.com'
 * - apiURL: 'https://api.opens2.com'
 * - baseURL: 'https://opens2.com'
 *
 * Let's say I want to add a skybox to the scene:
 * ```json
 * "skybox": {
 *   "path": "baseURL://backgrounds/milkyway",
 *   "loadingBackground": "rgb(9, 8, 17)",
 *   "size": 2048,
 *   "type": "webp",
 * }
 * ```
 *
 * Then we can modify the baseURL to point to the correct location:
 * ```ts
 * import { S2Map } from 's2maps-gpu';
 * import type { MapOptions } from 's2maps-gpu';
 *
 * const urlMap: UrlMap = {
 *   baseURL: 'http://localhost:3000',
 * };
 * const map = new S2Map({ ..., urlMap });
 * ```
 *
 * This is obviously more useful when working with environment variables to point to development
 * and production servers without having to change the code.
 * @see {@link adjustURL} for details on implementation
 */
export interface UrlMap {
  /** { schemeName: href } */
  [schemeName: string]: string;
}

const URL_MAP: UrlMap = {
  s2maps: 'https://api.s2maps.com',
  opens2: 'https://api.opens2.com',
  mapbox: 'https://api.mapbox.com',
  apiURL: 'https://api.opens2.com',
  baseURL: 'https://opens2.com',
};

/**
 * Adjust a URL either using:
 * the URL_MAP (replace "s2maps://", "opens2://", or "mapbox://")
 * the apiURL (replace "apiURL://") or baseURL (replace "baseURL://")
 * which is defined by the user in the {@link MapOptions} `urlMap` property.
 * @param input - the input URL
 * @param userMap - the user defined guide on how to replace the URL_MAP
 * @returns the adjusted URL
 */
export function adjustURL(input: string, userMap: UrlMap = {}): string {
  // replace all URL_MAP instances
  for (const [key, value] of Object.entries({ ...URL_MAP, ...userMap })) {
    input = input.replace(`${key}://`, `${value}/`);
  }
  return input;
}

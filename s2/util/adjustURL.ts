const URL_MAP: Record<string, string> = {
  s2maps: 'https://api.s2maps.com',
  opens2: 'https://api.opens2.com',
  mapbox: 'https://api.mapbox.com'
}

/** Adjust a URL either using:
 * the URL_MAP (replace "s2maps://", "opens2://", or "mapbox://")
 * the apiURL (replace "apiURL://") or baseURL (replace "baseURL://")
 * which is defined by the user in the MapOptions.
 */
export default function adjustURL (input: string, apiURL: string, baseURL: string): string {
  if (apiURL === '') apiURL = URL_MAP.opens2
  if (baseURL === '') baseURL = URL_MAP.opens2
  // replace all URL_MAP instances
  for (const [key, value] of Object.entries(URL_MAP)) {
    input = input.replace(`${key}://`, `${value}/`)
    input = input.replace('apiURL://', `${apiURL}/`)
    input = input.replace('baseURL://', `${baseURL}/`)
  }
  return input
}

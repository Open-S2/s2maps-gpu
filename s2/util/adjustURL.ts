declare const process: {
  env: {
    API_URL?: string
    NEXT_PUBLIC_API_URL?: string
  }
}

const URL_MAP: Record<string, string> = {
  s2maps: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.s2maps.com',
  opens2: process.env.NEXT_PUBLIC_API_URL ?? 'https://api.opens2.com',
  mapbox: 'https://api.mapbox.com'
}

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

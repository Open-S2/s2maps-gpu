declare const process: {
  env: {
    NEXT_PUBLIC_API_URL: string
  }
}

const URL_MAP = {
  s2maps: process.env.NEXT_PUBLIC_API_URL,
  mapbox: 'https://api.mapbox.com'
}

export default function adjustURL (input: string): string {
  // replace all URL_MAP instances
  for (const [key, value] of Object.entries(URL_MAP)) {
    input = input.replace(`${key}://`, `${value}/`)
  }
  return input
}

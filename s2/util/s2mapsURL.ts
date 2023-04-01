declare const process: {
  env: {
    NEXT_PUBLIC_API_URL: string
  }
}

export default function s2mapsURL (input: string): string {
  return input.replace('s2maps://', process.env.NEXT_PUBLIC_API_URL + '/')
}

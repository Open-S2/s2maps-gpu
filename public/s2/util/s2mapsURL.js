// @flow
const { NEXT_PUBLIC_API_URL } = process.env
export default function s2mapsURL (input: string): string {
  return input.replace('s2maps://', `${NEXT_PUBLIC_API_URL}/`)
}

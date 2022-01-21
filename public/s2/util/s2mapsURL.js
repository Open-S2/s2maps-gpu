// @flow
export default function s2mapsURL (input: string): string {
  return input.replace('s2maps://', 'https://api.s2maps.io/')
}

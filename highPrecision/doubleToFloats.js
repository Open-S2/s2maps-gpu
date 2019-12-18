// @flow
export default function doubleToFloats (num: number): [number, number] {
  const high = Math.fround(num)
  const low = num - high

  return [high, low]
}

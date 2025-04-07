/**
 * calculate simplification of line vector data using
 * optimized Douglas-Peucker algorithm
 * @param coords
 * @param first
 * @param last
 * @param sqTolerance
 */
export default function simplify(
  coords: number[],
  first: number,
  last: number,
  sqTolerance: number,
): void {
  let maxSqDist = sqTolerance;
  const mid = (last - first) >> 1;
  let minPosToMid = last - first;
  let index: undefined | number;

  const as = coords[first];
  const at = coords[first + 1];
  const bs = coords[last];
  const bt = coords[last + 1];

  for (let i = first + 3; i < last; i += 3) {
    const d = getSqSegDist(coords[i], coords[i + 1], as, at, bs, bt);

    if (d > maxSqDist) {
      index = i;
      maxSqDist = d;
    } else if (d === maxSqDist) {
      // a workaround to ensure we choose a pivot close to the middle of the list,
      // reducing recursion depth, for certain degenerate inputs
      const posToMid = Math.abs(i - mid);
      if (posToMid < minPosToMid) {
        index = i;
        minPosToMid = posToMid;
      }
    }
  }

  if (index !== undefined && maxSqDist > sqTolerance) {
    if (index - first > 3) simplify(coords, first, index, sqTolerance);
    coords[index + 2] = maxSqDist;
    if (last - index > 3) simplify(coords, index, last, sqTolerance);
  }
}

// square distance from a point to a segment
/**
 * @param ps
 * @param pt
 * @param s
 * @param t
 * @param bs
 * @param bt
 */
function getSqSegDist(
  ps: number,
  pt: number,
  s: number,
  t: number,
  bs: number,
  bt: number,
): number {
  let ds = bs - s;
  let dt = bt - t;

  if (ds !== 0 || dt !== 0) {
    const m = ((ps - s) * ds + (pt - t) * dt) / (ds * ds + dt * dt);

    if (m > 1) {
      s = bs;
      t = bt;
    } else if (m > 0) {
      s += ds * m;
      t += dt * m;
    }
  }

  ds = ps - s;
  dt = pt - t;

  return ds * ds + dt * dt;
}

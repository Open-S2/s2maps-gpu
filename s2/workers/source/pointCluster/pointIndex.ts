import { projectX, projectY } from 'gis-tools';

/** A basic vector point that allows for arbitrary data */
export interface Point<T> {
  x: number;
  y: number;
  data: T;
}

/**
 * # Point Index
 *
 * A kd-tree based point index
 */
export default class PointIndex<T> {
  nodeSize: number;
  points: Array<Point<T>> = [];
  #sorted = false;
  /** @param nodeSize - size of the kd-tree leaf node */
  constructor(nodeSize = 64) {
    this.nodeSize = nodeSize;
  }

  /**
   * Add a point to the index.
   * @param x - x coordinate
   * @param y - y coordinate
   * @param data - data related to point to add
   */
  add(x: number, y: number, data: T): void {
    if (isNaN(x) || isNaN(y)) return;
    this.points.push({ x: projectX(x), y: projectY(y), data });
    this.#sorted = false;
  }

  /**
   * Add a new point to the index
   * @param point - a point to add
   */
  addPoint(point: Point<T>): void {
    this.points.push(point);
    this.#sorted = false;
  }

  /** Perform indexing of the added points. */
  sort(): void {
    if (this.#sorted) return;
    // kd-sort both arrays for efficient search
    this.#sort(this.nodeSize, 0, this.points.length - 1, 0);
    this.#sorted = true;
  }

  /**
   * Search the index for items within a given bounding box.
   * @param minX - minimum x value
   * @param minY - minimum y value
   * @param maxX - maximum x value
   * @param maxY - maximum y value
   * @returns All points found within the bounding box
   */
  range(minX: number, minY: number, maxX: number, maxY: number): Array<Point<T>> {
    this.sort();

    const { nodeSize } = this;
    const stack: Array<[left: number, right: number, axis: number]> = [
      [0, this.points.length - 1, 0],
    ];
    const result: Array<Point<T>> = []; // ids of items that are in range

    // recursively search for items in range in the kd-sorted arrays
    while (stack.length > 0) {
      const [left, right, axis] = stack.pop() as [left: number, right: number, axis: number];

      // if we reached "tree node", search linearly
      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          const point = this.points[i];
          const { x, y } = point;
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(this.points[i]);
        }
        continue;
      }

      // otherwise find the middle index
      const m = (left + right) >> 1;

      // include the middle item if it's in range
      const { x, y } = this.points[m];
      if (x >= minX && x <= maxX && y >= minY && y <= maxY) result.push(this.points[m]);

      // queue search in halves that intersect the query
      if (axis === 0 ? minX <= x : minY <= y) stack.push([left, m - 1, 1 - axis]);
      if (axis === 0 ? maxX >= x : maxY >= y) stack.push([m + 1, right, 1 - axis]);
    }

    return result;
  }

  /**
   * Search the index for items within a given radius.
   * @param qx - query point X-coordinate
   * @param qy - query point Y-coordinate
   * @param r - radius
   * @returns All points found within the radius of the query point
   */
  radius(qx: number, qy: number, r: number): Array<Point<T>> {
    this.sort();

    const { nodeSize, points } = this;
    const stack: Array<[left: number, right: number, axis: number]> = [[0, points.length - 1, 0]]; // left, right, axis
    const result: Array<Point<T>> = []; // ids of items that are in range
    const r2 = r * r;

    // recursively search for items within radius in the kd-sorted arrays
    while (stack.length > 0) {
      const [left, right, axis] = stack.pop() as [left: number, right: number, axis: number];

      // if we reached "tree node", search linearly
      if (right - left <= nodeSize) {
        for (let i = left; i <= right; i++) {
          const point = points[i];
          if (this.#sqDist(point.x, point.y, qx, qy) <= r2) result.push(point);
        }
        continue;
      }

      // otherwise find the middle index
      const m = (left + right) >> 1;

      // include the middle item if it's in range
      const point = points[m];
      const { x, y } = point;
      if (this.#sqDist(x, y, qx, qy) <= r2) result.push(point);

      // queue search in halves that intersect the query
      if (axis === 0 ? qx - r <= x : qy - r <= y) stack.push([left, m - 1, 1 - axis]);
      if (axis === 0 ? qx + r >= x : qy + r >= y) stack.push([m + 1, right, 1 - axis]);
    }

    return result;
  }

  /**
   * Perform indexing/sorting of the added points.
   * @param nodeSize - tree node size
   * @param left - left index
   * @param right - right index
   * @param axis - axis (0 for x or 1 for y)
   */
  #sort(nodeSize: number, left: number, right: number, axis: number): void {
    if (right - left <= nodeSize) return;

    const m = (left + right) >> 1; // middle index

    // sort ids and coords around the middle index so that the halves lie
    // either left/right or top/bottom correspondingly (taking turns)
    this.select(m, left, right, axis);

    // recursively kd-sort first half and second half on the opposite axis
    this.#sort(nodeSize, left, m - 1, 1 - axis);
    this.#sort(nodeSize, m + 1, right, 1 - axis);
  }

  /**
   * Custom Floyd-Rivest selection algorithm: sort ids and coords so that
   * [left..k-1] items are smaller than k-th item (on either x or y axis)
   * @param k - index
   * @param left - left index
   * @param right - right index
   * @param axis - axis (0 for x or 1 for y)
   */
  select(k: number, left: number, right: number, axis: number): void {
    const { points } = this;
    while (right > left) {
      if (right - left > 600) {
        const n = right - left + 1;
        const m = k - left + 1;
        const z = Math.log(n);
        const s = 0.5 * Math.exp((2 * z) / 3);
        const sd = 0.5 * Math.sqrt((z * s * (n - s)) / n) * (m - n / 2 < 0 ? -1 : 1);
        const newLeft = Math.max(left, Math.floor(k - (m * s) / n + sd));
        const newRight = Math.min(right, Math.floor(k + ((n - m) * s) / n + sd));
        this.select(k, newLeft, newRight, axis);
      }

      const p = points[k];
      const t = axis === 0 ? p.x : p.y;
      let i = left;
      let j = right;

      this.#swap(left, k);
      const rp = points[right];
      if (axis === 0 ? rp.x > t : rp.y > t) this.#swap(left, right);

      while (i < j) {
        this.#swap(i, j);
        i++;
        j--;
        while ((axis === 0 ? points[i].x : points[i].y) < t) i++;
        while ((axis === 0 ? points[j].x : points[j].y) > t) j--;
      }

      const lp = points[left];
      if ((axis === 0 ? lp.x : lp.y) === t) {
        this.#swap(left, j);
      } else {
        j++;
        this.#swap(j, right);
      }

      if (j <= k) left = j + 1;
      if (k <= j) right = j - 1;
    }
  }

  /**
   * Swap two points positions in the array
   * @param i - first index
   * @param j - second index
   */
  #swap(i: number, j: number): void {
    const { points } = this;
    [points[i], points[j]] = [points[j], points[i]];
  }

  /**
   * Squared distance between two points
   * @param ax - point A x coordinate
   * @param ay - point A y coordinate
   * @param bx - point B x coordinate
   * @param by - point B y coordinate
   * @returns the squared distance
   */
  #sqDist(ax: number, ay: number, bx: number, by: number): number {
    const dx = ax - bx;
    const dy = ay - by;
    return dx * dx + dy * dy;
  }
}

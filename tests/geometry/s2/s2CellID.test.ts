import {
  boundsST,
  centerST,
  child,
  childPosition,
  children,
  childrenIJ,
  contains,
  distance,
  face,
  fromDistance,
  fromFace,
  fromIJ,
  fromIJSame,
  fromIJWrap,
  fromLonLat,
  fromS2Point,
  fromST,
  fromUV,
  intersects,
  isFace,
  isLeaf,
  level,
  neighbors,
  neighborsIJ,
  next,
  parent,
  pos,
  prev,
  range,
  sizeST,
  toIJ,
  toLonLat,
  toS2Point,
  toST,
  toUV,
  vertexNeighbors,
} from 'geometry/s2/s2CellID';
import { describe, expect, it } from 'bun:test';

describe('boundsST', () => {
  it('should return the bounds for a given id and level', () => {
    expect(boundsST(fromFace(0), 0)).toEqual([0, 0, 1, 1]);
    expect(boundsST(fromFace(0), 1)).toEqual([0.25, 0.25, 0.75, 0.75]);
    expect(boundsST(fromFace(0), 2)).toEqual([0.375, 0.375, 0.625, 0.625]);
    expect(boundsST(fromFace(1), 0)).toEqual([0, 0, 1, 1]);
  });
});

describe('centerST', () => {
  it('should return the center for a given id and level', () => {
    expect(centerST(fromFace(0))).toEqual([0, 0.5, 0.5]);
    expect(centerST(fromFace(1))).toEqual([1, 0.5, 0.5]);
    expect(centerST(fromFace(2))).toEqual([2, 0.5, 0.5]);
    expect(centerST(fromFace(3))).toEqual([3, 0.5, 0.5]);
  });
});

describe('child', () => {
  it('should return the child cell', () => {
    expect(child(fromFace(0), 0n)).toBe(288230376151711744n);
    expect(child(fromFace(0), 1n)).toBe(864691128455135232n);
    expect(child(fromFace(0), 2n)).toBe(1441151880758558720n);
    expect(child(fromFace(0), 3n)).toBe(2017612633061982208n);
  });
});

describe('childPosition', () => {
  it('should return the child position', () => {
    expect(childPosition(fromFace(0), 0)).toBe(0);
    expect(childPosition(fromFace(0), 1)).toBe(2);
    expect(childPosition(fromFace(0), 2)).toBe(0);
    expect(childPosition(fromFace(1), 0)).toBe(1);
    expect(childPosition(child(fromFace(0), 1n), 1)).toBe(1);
  });
});

describe('children', () => {
  it('should return the children cells', () => {
    expect(children(fromFace(0))).toEqual([
      288230376151711744n,
      864691128455135232n,
      1441151880758558720n,
      2017612633061982208n,
    ]);
  });
});

describe('childrenIJ', () => {
  it('should return the children cells', () => {
    expect(childrenIJ(0, 0, 0, 0)).toEqual([
      288230376151711744n,
      2017612633061982208n,
      864691128455135232n,
      1441151880758558720n,
    ]);
  });
});

describe('contains', () => {
  it('should return if the cell contains the given cell', () => {
    expect(contains(fromFace(0), fromFace(0))).toBe(true);
    expect(contains(fromFace(0), fromFace(1))).toBe(false);
    expect(contains(fromFace(0), child(fromFace(0), 1n))).toBe(true);
  });
});

describe('distance', () => {
  it('should return the distance between two cells', () => {
    expect(distance(fromFace(0), 0)).toBe(0n);
    expect(distance(fromFace(0), 1)).toBe(2n);
    expect(distance(fromFace(0), 2)).toBe(8n);
    expect(distance(fromFace(0), 3)).toBe(32n);
  });
});

describe('face', () => {
  it('should return the face for a given cell', () => {
    expect(face(fromFace(0))).toBe(0);
    expect(face(fromFace(1))).toBe(1);
    expect(face(fromFace(2))).toBe(2);
    expect(face(fromFace(3))).toBe(3);
    expect(face(fromFace(4))).toBe(4);
    expect(face(fromFace(5))).toBe(5);
  });
});

describe('fromDistance', () => {
  it('should return the cell id for a given distance', () => {
    expect(fromDistance(0n)).toBe(1n);
    expect(fromDistance(1n)).toBe(3n);
    expect(fromDistance(2n)).toBe(5n);
    expect(fromDistance(3n)).toBe(7n);
    expect(fromDistance(4n)).toBe(9n);
    expect(fromDistance(5n)).toBe(11n);
  });
});

describe('fromFace', () => {
  it('should return the cell id for a given face', () => {
    expect(fromFace(0)).toBe(1152921504606846976n);
    expect(fromFace(1)).toBe(3458764513820540928n);
    expect(fromFace(2)).toBe(5764607523034234880n);
    expect(fromFace(3)).toBe(8070450532247928832n);
    expect(fromFace(4)).toBe(10376293541461622784n);
    expect(fromFace(5)).toBe(12682136550675316736n);
  });
});

describe('fromIJ', () => {
  it('should return the cell id for a given i-j', () => {
    expect(fromIJ(0, 0, 0)).toBe(1n);
    expect(fromIJ(0, 1, 0)).toBe(3n);
    expect(fromIJ(0, 1, 1)).toBe(5n);
    expect(fromIJ(0, 0, 1)).toBe(7n);
  });
});

describe('fromIJSame', () => {
  it('should return the cell id for a given i-j', () => {
    expect(fromIJSame(0, 0, 0, true)).toBe(1n);
    expect(fromIJSame(0, 1, 0, true)).toBe(3n);
    expect(fromIJSame(0, 1, 1, true)).toBe(5n);
    expect(fromIJSame(0, 0, 1, true)).toBe(7n);
  });
});

describe('fromIJWrap', () => {
  it('should return the cell id for a given i-j', () => {
    expect(fromIJWrap(0, 0, 0)).toBe(1n);
    expect(fromIJWrap(0, 1, 0)).toBe(3n);
    expect(fromIJWrap(0, 1, 1)).toBe(5n);
    expect(fromIJWrap(0, 0, 1)).toBe(7n);
  });
});

describe('fromLonLat', () => {
  it('should return the cell id for a given lon-lat', () => {
    expect(fromLonLat(0, 0)).toBe(1152921504606846977n);
    expect(fromLonLat(90, 0)).toBe(3458764513820540929n);
    expect(fromLonLat(0, 90)).toBe(5764607523034234881n);
    expect(fromLonLat(-90, 0)).toBe(10376293541461622785n);
    expect(fromLonLat(0, -90)).toBe(12682136550675316737n);
  });
});

describe('fromS2Point', () => {
  it('should return the cell id for a given s2 point', () => {
    expect(fromS2Point([1, 0, 0])).toBe(1152921504606846977n);
    expect(fromS2Point([0, 1, 0])).toBe(3458764513820540929n);
    expect(fromS2Point([0, 0, 1])).toBe(5764607523034234881n);
    expect(fromS2Point([-1, 0, 0])).toBe(8070450532247928833n);
    expect(fromS2Point([0, -1, 0])).toBe(10376293541461622785n);
    expect(fromS2Point([0, 0, -1])).toBe(12682136550675316737n);
  });
});

describe('fromST', () => {
  it('should return the cell id for a given a Face-S-T', () => {
    expect(fromST(0, 0, 0)).toBe(1n);
    expect(fromST(0, 1, 0)).toBe(2305843009213693951n);
    expect(fromST(0, 0, 1)).toBe(768614336404564651n);
    expect(fromST(0, 0.5, 0.5)).toBe(1152921504606846977n);
    expect(fromST(0, 1, 1)).toBe(1537228672809129301n);
  });
});

describe('fromUV', () => {
  it('should return the cell id for a given a Face-U-V', () => {
    expect(fromUV(0, 0, 0)).toBe(1152921504606846977n);
    expect(fromUV(0, 1, 0)).toBe(1729382256910270463n);
    expect(fromUV(0, 0, 1)).toBe(1345075088707988139n);
    expect(fromUV(0, -1, 0)).toBe(576460752303423489n);
    expect(fromUV(0, 0, -1)).toBe(2113689425112552789n);
  });
});

describe('intersects', () => {
  it('should return if the cell intersects the given cell', () => {
    expect(intersects(fromFace(0), fromFace(0))).toBe(true);
    expect(intersects(fromFace(0), fromFace(1))).toBe(false);
    expect(intersects(fromFace(0), child(fromFace(0), 1n))).toBe(true);
  });
});

describe('isFace', () => {
  it('should return if the cell is a face', () => {
    expect(isFace(1152921504606846976n)).toBe(true);
    expect(isFace(1152921504606846977n)).toBe(false);
  });
});

describe('isLeaf', () => {
  it('should return if the cell is a leaf', () => {
    expect(isLeaf(1152921504606846976n)).toBe(false);
    expect(isLeaf(1152921504606846977n)).toBe(true);
  });
});

describe('level', () => {
  it('should return the level for a given cell', () => {
    expect(level(1152921504606846976n)).toBe(0);
    expect(level(1152921504606846977n)).toBe(30);
  });
});

describe('neighbors', () => {
  it('should return the neighbors cells', () => {
    expect(neighbors(fromFace(0))).toEqual([
      12682136550675316736n,
      3458764513820540928n,
      5764607523034234880n,
      10376293541461622784n,
    ]);
  });
});

describe('neighborsIJ', () => {
  it('should return the neighbors cells', () => {
    expect(neighborsIJ(0, 0, 0, 0)).toEqual([
      12682136550675316736n,
      3458764513820540928n,
      5764607523034234880n,
      10376293541461622784n,
    ]);
  });
});

describe('next', () => {
  it('should return the next cell', () => {
    expect(next(fromFace(0))).toBe(3458764513820540928n);
    expect(next(fromFace(1))).toBe(5764607523034234880n);
    expect(next(fromFace(2))).toBe(8070450532247928832n);
    expect(next(fromFace(3))).toBe(10376293541461622784n);
  });
});

describe('parent', () => {
  it('should return the parent cell', () => {
    expect(parent(child(fromFace(0), 0n))).toBe(fromFace(0));
  });
});

describe('pos', () => {
  it('should return the position for a given cell', () => {
    expect(pos(fromFace(0))).toBe(1152921504606846976n);
    expect(pos(fromFace(1))).toBe(1152921504606846976n);
    expect(pos(fromFace(2))).toBe(1152921504606846976n);
    expect(pos(fromFace(3))).toBe(1152921504606846976n);
  });
});

describe('prev', () => {
  it('should return the prev cell', () => {
    expect(prev(fromFace(1))).toBe(1152921504606846976n);
    expect(prev(fromFace(2))).toBe(3458764513820540928n);
    expect(prev(fromFace(3))).toBe(5764607523034234880n);
    expect(prev(fromFace(4))).toBe(8070450532247928832n);
    expect(prev(fromFace(5))).toBe(10376293541461622784n);
  });
});

describe('range', () => {
  it('should return the range for a given level', () => {
    expect(range(0n)).toEqual([1n, -1n]);
    expect(range(1n)).toEqual([1n, 1n]);
    expect(range(fromFace(0))).toEqual([1n, 2305843009213693951n]);
  });
});

describe('sizeST', () => {
  it('should return the size for a given level', () => {
    expect(sizeST(0)).toBe(1);
    expect(sizeST(1)).toBe(0.5);
    expect(sizeST(2)).toBe(0.25);
  });
});

describe('toIJ', () => {
  it('should return the i-j for a given cell', () => {
    expect(toIJ(fromFace(0))).toEqual([0, 536870912, 536870912, 0]);
    expect(toIJ(fromFace(1))).toEqual([1, 536870912, 536870912, 1]);
    expect(toIJ(fromFace(2))).toEqual([2, 536870912, 536870912, 0]);
    expect(toIJ(fromFace(3))).toEqual([3, 536870912, 536870912, 1]);
  });
  it('also given a level, should return the i-j for a given cell', () => {
    expect(toIJ(fromFace(0), 0)).toEqual([0, 0, 0, 0]);
    expect(toIJ(fromFace(0), 1)).toEqual([0, 1, 1, 0]);
  });
});

describe('toLonLat', () => {
  it('should return the lon-lat for a given cell', () => {
    expect(toLonLat(fromFace(0))).toEqual([0, 0]);
    expect(toLonLat(fromFace(1))).toEqual([90, 0]);
    expect(toLonLat(fromFace(2))).toEqual([-180, 90]);
    expect(toLonLat(fromFace(3))).toEqual([-180, -0]);
  });
});

describe('toS2Point', () => {
  it('should return the s2 point for a given cell', () => {
    expect(toS2Point(fromFace(0))).toEqual([1, 0, 0]);
    expect(toS2Point(fromFace(1))).toEqual([-0, 1, 0]);
    expect(toS2Point(fromFace(2))).toEqual([-0, -0, 1]);
    expect(toS2Point(fromFace(3))).toEqual([-1, -0, -0]);
  });
});

describe('toST', () => {
  it('should return the s-t for a given cell', () => {
    expect(toST(fromFace(0))).toEqual([0, 0.5, 0.5]);
    expect(toST(fromFace(1))).toEqual([1, 0.5, 0.5]);
    expect(toST(fromFace(2))).toEqual([2, 0.5, 0.5]);
    expect(toST(fromFace(3))).toEqual([3, 0.5, 0.5]);
    expect(toST(child(fromFace(0), 0n))).toEqual([0, 0.25, 0.25]);
    expect(toST(child(fromFace(0), 1n))).toEqual([0, 0.25, 0.75]);
  });
});

describe('toUV', () => {
  it('should return the u-v for a given cell', () => {
    expect(toUV(fromFace(0))).toEqual([0, 0, 0]);
    expect(toUV(fromFace(1))).toEqual([1, 0, 0]);
    expect(toUV(fromFace(2))).toEqual([2, 0, 0]);
    expect(toUV(fromFace(3))).toEqual([3, 0, 0]);
    expect(toUV(child(fromFace(0), 0n))).toEqual([0, -0.41666666666666663, -0.41666666666666663]);
    expect(toUV(child(fromFace(0), 1n))).toEqual([0, -0.41666666666666663, 0.41666666666666663]);
  });
});

describe('vertexNeighbors', () => {
  it('should return the vertex neighbors for a given cell', () => {
    expect(vertexNeighbors(fromFace(0))).toEqual([
      1152921504606846976n,
      3458764513820540928n,
      5764607523034234880n,
    ]);
    expect(vertexNeighbors(123974589433424n)).toEqual([
      123974589433424n,
      123974589433584n,
      123974589433776n,
      123974589433616n,
    ]);
  });
});

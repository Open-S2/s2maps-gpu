import {
  add,
  addScalar,
  distance,
  distanceEarth,
  fromIJ,
  fromLonLat,
  fromLonLatGL,
  fromS2CellID,
  fromST,
  fromSTGL,
  fromUV,
  fromUVGL,
  getFace,
  length,
  mul,
  mulScalar,
  normalize,
  sub,
  subScalar,
  toIJ,
  toLonLat,
  toS2CellID,
  toST,
  toUV,
} from 'geometry/s2/s2Point';
import { describe, expect, it } from 'bun:test';

describe('add', (): void => {
  it('should add 1 to each component of an XYZ point', (): void => {
    expect(add([1, 2, 3], 1)).toEqual([2, 3, 4]);
  });
});

describe('addScalar', (): void => {
  it('should add an XYZ point to another XYZ point', (): void => {
    expect(addScalar([1, 2, 3], [1, 2, 3])).toEqual([2, 4, 6]);
  });
});

describe('distance', (): void => {
  it('should calculate the distance between two XYZ points', (): void => {
    expect(distance([1, 2, 3], [4, 5, 6])).toBeCloseTo(5.196152422706632);
  });
});

describe('distanceEarth', (): void => {
  it('should calculate the distance between two of the same lon/lat points', (): void => {
    expect(distanceEarth([0, 0, 0], [0, 0, 0])).toBeCloseTo(0);
  });
  it('should calculate the distance between two different lon/lat points', (): void => {
    expect(distanceEarth([0, 0, 0], [90, 0, 0])).toBeCloseTo(574032330);
  });
});

describe('fromIJ', (): void => {
  it('should convert an Face-I-J of 0-0-0 to an XYZ point', (): void => {
    expect(fromIJ(0, 0, 0)).toEqual([1, -1, -1]);
  });
  it('should convert an Face-I-J of 1-0-0 to an XYZ point', (): void => {
    expect(fromIJ(1, 0, 0)).toEqual([1, 1, -1]);
  });
  it('should convert an Face-I-J of 2-20-100 to an XYZ point', (): void => {
    expect(fromIJ(2, 20, 100)).toEqual([0.9999999503294631, 0.9999997516473249, 1]);
  });
});

describe('fromLonLat', (): void => {
  it('should convert a lon/lat of 0-0 to an XYZ point', (): void => {
    expect(fromLonLat(0, 0)).toEqual([1, 0, 0]);
  });
  it('should convert a lon/lat of 90-0 to an XYZ point', (): void => {
    expect(fromLonLat(90, 0)).toEqual([0.00000000000000006123233995736766, 1, 0]);
  });
  it('should convert a lon/lat of 0-90 to an XYZ point', (): void => {
    expect(fromLonLat(0, 90)).toEqual([0.00000000000000006123233995736766, 0, 1]);
  });
});

describe('fromLonLatGL', (): void => {
  it('should convert a lon/lat of 0-0 to an XYZ point', (): void => {
    expect(fromLonLatGL(0, 0)).toEqual([0, 0, 1]);
  });
  it('should convert a lon/lat of 90-0 to an XYZ point', (): void => {
    expect(fromLonLatGL(90, 0)).toEqual([1, 0, 0.00000000000000006123233995736766]);
  });
  it('should convert a lon/lat of 0-90 to an XYZ point', (): void => {
    expect(fromLonLatGL(0, 90)).toEqual([0, 1, 0.00000000000000006123233995736766]);
  });
});

// fromS2CellID
describe('fromS2CellID', (): void => {
  it('should convert a S2CellID of 0n to an XYZ point', (): void => {
    expect(fromS2CellID(0n)).toEqual([1, -1, -1]);
  });
  it('should convert a S2CellID of 1n to an XYZ point', (): void => {
    expect(fromS2CellID(1n)).toEqual([1, -1, -1]);
  });
  it('should convert a S2CellID of 2n to an XYZ point', (): void => {
    expect(fromS2CellID(2n)).toEqual([1, -0.9999999975164731, -1]);
  });
  it('should convert a S2CellID of 12345678n to an XYZ point', (): void => {
    expect(fromS2CellID(12345678n)).toEqual([1, -0.9999983757739246, -0.9999918614948804]);
  });
});

describe('fromST', (): void => {
  it('should convert a Face-S-T of 0-0-0 to an XYZ point', (): void => {
    expect(fromST(0, 0, 0)).toEqual([1, -1, -1]);
  });
  it('should convert a Face-S-T of 1-0-0 to an XYZ point', (): void => {
    expect(fromST(1, 0, 0)).toEqual([1, 1, -1]);
  });
  it('should convert a Face-S-T of 2-0-0 to an XYZ point', (): void => {
    expect(fromST(2, 0, 0)).toEqual([1, 1, 1]);
  });
  it('should convert a Face-S-T of 3-0-0 to an XYZ point', (): void => {
    expect(fromST(3, 0, 0)).toEqual([-1, 1, 1]);
  });
  it('should convert a Face-S-T of 4-0-0 to an XYZ point', (): void => {
    expect(fromST(4, 0, 0)).toEqual([-1, -1, 1]);
  });
  it('should convert a Face-S-T of 5-0-0 to an XYZ point', (): void => {
    expect(fromST(5, 0, 0)).toEqual([-1, -1, -1]);
  });
});

describe('fromSTGL', (): void => {
  it('should convert a Face-S-T of 0-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(0, 0, 0)).toEqual([-1, -1, 1]);
  });
  it('should convert a Face-S-T of 1-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(1, 0, 0)).toEqual([1, -1, 1]);
  });
  it('should convert a Face-S-T of 2-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(2, 0, 0)).toEqual([1, 1, 1]);
  });
  it('should convert a Face-S-T of 3-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(3, 0, 0)).toEqual([1, 1, -1]);
  });
  it('should convert a Face-S-T of 4-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(4, 0, 0)).toEqual([-1, 1, -1]);
  });
  it('should convert a Face-S-T of 5-0-0 to an XYZ point', (): void => {
    expect(fromSTGL(5, 0, 0)).toEqual([-1, -1, -1]);
  });
});

describe('fromUV', (): void => {
  it('should convert a Face-U-V of 0-0-0 to an XYZ point', (): void => {
    expect(fromUV(0, 0, 0)).toEqual([1, 0, 0]);
  });
  it('should convert a Face-U-V of 1-0-0 to an XYZ point', (): void => {
    expect(fromUV(1, 0, 0)).toEqual([-0, 1, 0]);
  });
  it('should convert a Face-U-V of 2-0-0 to an XYZ point', (): void => {
    expect(fromUV(2, 0, 0)).toEqual([-0, -0, 1]);
  });
  it('should convert a Face-U-V of 3-0-0 to an XYZ point', (): void => {
    expect(fromUV(3, 0, 0)).toEqual([-1, -0, -0]);
  });
  it('should convert a Face-U-V of 4-0-0 to an XYZ point', (): void => {
    expect(fromUV(4, 0, 0)).toEqual([0, -1, -0]);
  });
  it('should convert a Face-U-V of 5-0-0 to an XYZ point', (): void => {
    expect(fromUV(5, 0, 0)).toEqual([0, 0, -1]);
  });
});

describe('fromUVGL', (): void => {
  it('should convert a Face-U-V of 0-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(0, 0, 0)).toEqual([0, 0, 1]);
  });
  it('should convert a Face-U-V of 1-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(1, 0, 0)).toEqual([1, 0, -0]);
  });
  it('should convert a Face-U-V of 2-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(2, 0, 0)).toEqual([-0, 1, -0]);
  });
  it('should convert a Face-U-V of 3-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(3, 0, 0)).toEqual([-0, -0, -1]);
  });
  it('should convert a Face-U-V of 4-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(4, 0, 0)).toEqual([-1, -0, 0]);
  });
  it('should convert a Face-U-V of 5-0-0 to an XYZ point', (): void => {
    expect(fromUVGL(5, 0, 0)).toEqual([0, -1, 0]);
  });
});

describe('getFace', (): void => {
  it('should return the face of an XYZ point', (): void => {
    expect(getFace([1, 0, 0])).toBe(0);
    expect(getFace([0, 1, 0])).toBe(1);
    expect(getFace([0, 0, 1])).toBe(2);
    expect(getFace([-1, 0, 0])).toBe(3);
    expect(getFace([0, -1, 0])).toBe(4);
    expect(getFace([0, 0, -1])).toBe(5);
    expect(getFace([0.5, 0.5, 0.5])).toBe(2);
  });
});

describe('length', (): void => {
  it('should calculate the length of an XYZ point', (): void => {
    expect(length([1, 2, 3])).toBeCloseTo(3.7416573867739413);
  });
});

describe('mul', (): void => {
  it('should multiply each component of an XYZ point by 2', (): void => {
    expect(mul([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });
});

describe('mulScalar', (): void => {
  it('should multiply each component of an XYZ point by another XYZ point', (): void => {
    expect(mulScalar([1, 2, 3], [2, 3, 4])).toEqual([2, 6, 12]);
  });
});

describe('normalize', (): void => {
  it('should normalize an XYZ point', (): void => {
    expect(normalize([1, 2, 3])).toEqual([
      0.2672612419124244, 0.5345224838248488, 0.8017837257372732,
    ]);
  });
});

describe('sub', (): void => {
  it('should subtract 1 from each component of an XYZ point', (): void => {
    expect(sub([1, 2, 3], 1)).toEqual([0, 1, 2]);
  });
});

describe('subScalar', (): void => {
  it('should subtract an XYZ point from another XYZ point', (): void => {
    expect(subScalar([1, 2, 3], [1, 2, 3])).toEqual([0, 0, 0]);
  });
});

describe('toIJ', (): void => {
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(toIJ([1, -1, -1])).toEqual([5, 0, 1073741823]);
  });
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(toIJ([1, 1, -1])).toEqual([5, 1073741823, 1073741823]);
  });
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(toIJ([0.9999999503294631, 0.9999997516473249, 1])).toEqual([2, 20, 100]);
  });
  it('should convert an XYZ point to a Face-I-J including a level of 10', (): void => {
    expect(toIJ([1, -1, -1], 10)).toEqual([5, 0, 1023]);
  });
});

describe('toLonLat', (): void => {
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(toLonLat([1, 0, 0])).toEqual([0, 0]);
  });
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(toLonLat([0.00000000000000006123233995736766, 1, 0])).toEqual([90, 0]);
  });
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(toLonLat([0.00000000000000006123233995736766, 0, 1])).toEqual([0, 90]);
  });
});

describe('toS2CellID', (): void => {
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(toS2CellID([1, -1, -1])).toBe(13835058055282163711n);
  });
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(toS2CellID([1, 1, -1])).toBe(13066443718877599061n);
  });
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(toS2CellID([0.9999999503294631, 0.9999997516473249, 1])).toBe(4611686018427419201n);
  });
});

describe('toST', (): void => {
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([1, -1, -1])).toEqual([5, 0, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([1, 1, -1])).toEqual([5, 1, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([1, 1, 1])).toEqual([2, 0, 0]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([-1, 1, 1])).toEqual([2, 1, 0]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([-1, -1, 1])).toEqual([2, 1, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(toST([-1, -1, -1])).toEqual([5, 0, 0]);
  });
});

describe('toUV', (): void => {
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([1, 0, 0])).toEqual([0, 0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([0, 1, 0])).toEqual([1, -0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([0, 0, 1])).toEqual([2, -0, -0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([-1, 0, 0])).toEqual([3, -0, -0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([0, -1, 0])).toEqual([4, -0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(toUV([0, 0, -1])).toEqual([5, 0, 0]);
  });
});

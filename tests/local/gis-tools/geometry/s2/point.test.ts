import { describe, expect, it, test } from 'vitest';
import {
  pointAdd,
  pointAddMut,
  pointAddScalar,
  pointCross,
  pointDistance,
  pointDistancePlanet,
  pointDiv,
  pointDivMutScalar,
  pointDivScalar,
  pointFromIJ,
  pointFromLonLat,
  pointFromLonLatGL,
  pointFromS2CellID,
  pointFromST,
  pointFromSTGL,
  pointFromUV,
  pointFromUVGL,
  pointGetFace,
  pointLength,
  pointMul,
  pointMulScalar,
  pointNormalize,
  pointSub,
  pointSubScalar,
  pointToIJ,
  pointToLonLat,
  pointToS2CellID,
  pointToST,
  pointToUV,
} from '../../../../../s2/gis-tools/geometry/s2/point';

import type { VectorPoint } from '../../../../../s2/gis-tools/geometry';

describe('pointAddScalar', (): void => {
  it('should add 1 to each component of an XYZ point', (): void => {
    expect(pointAddScalar({ x: 1, y: 2, z: 3 }, 1)).toEqual({ x: 2, y: 3, z: 4 });
  });
});

describe('pointAdd', (): void => {
  it('should add an XYZ point to another XYZ point', (): void => {
    expect(pointAdd({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('pointAddMut', (): void => {
  it('should add an XYZ point to another XYZ point in place', (): void => {
    const a: VectorPoint = { x: 1, y: 2, z: 3 };
    const b: VectorPoint = { x: 1, y: 2, z: 3 };
    pointAddMut(a, b);
    expect(a).toEqual({ x: 2, y: 4, z: 6 });
    expect(b).toEqual({ x: 1, y: 2, z: 3 });
  });
});

describe('pointMul', (): void => {
  it('should multiply each component of an XYZ point by another XYZ point', (): void => {
    expect(pointMul({ x: 1, y: 2, z: 3 }, { x: 2, y: 3, z: 4 })).toEqual({ x: 2, y: 6, z: 12 });
  });
});

describe('pointMulScalar', (): void => {
  it('should multiply each component of an XYZ point by 2', (): void => {
    expect(pointMulScalar({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 2, y: 4, z: 6 });
  });
});

describe('pointDiv', (): void => {
  it('should divide each component of an XYZ point by another XYZ point', (): void => {
    expect(pointDiv({ x: 1, y: 2, z: 3 }, { x: 2, y: 3, z: 4 })).toEqual({
      x: 0.5,
      y: 0.6666666666666666,
      z: 0.75,
    });
  });
});

describe('pointDivScalar', (): void => {
  it('should divide each component of an XYZ point by 2', (): void => {
    expect(pointDivScalar({ x: 1, y: 2, z: 3 }, 2)).toEqual({ x: 0.5, y: 1, z: 1.5 });
  });
});

describe('pointDivMutScalar', (): void => {
  it('should divide each component of an XYZ point by 2 in place', (): void => {
    const a: VectorPoint = { x: 1, y: 2, z: 3 };
    pointDivMutScalar(a, 2);
    expect(a).toEqual({ x: 0.5, y: 1, z: 1.5 });
  });
});

test('pointCross', (): void => {
  const a: VectorPoint = { x: 1, y: 2, z: 3 };
  const b: VectorPoint = { x: 1, y: 2, z: 3 };
  const c: VectorPoint = { x: 5, y: 6, z: 7 };
  expect(pointCross(a, b)).toEqual({ x: 0, y: 0, z: 0 });
  expect(pointCross(a, c)).toEqual({ x: -4, y: 8, z: -4 });
});

describe('pointDistance', (): void => {
  it('should calculate the pointDistance between two XYZ points', (): void => {
    expect(pointDistance({ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 })).toBeCloseTo(
      5.196152422706632,
    );
  });
});

describe('pointDistancePlanet', (): void => {
  it('should calculate the pointDistance between two of the same lon/lat points', (): void => {
    expect(pointDistancePlanet({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })).toBeCloseTo(0);
  });
  it('should calculate the pointDistance between two different lon/lat points', (): void => {
    expect(pointDistancePlanet({ x: 0, y: 0, z: 0 }, { x: 90, y: 0, z: 0 })).toBeCloseTo(574032330);
  });
});

describe('pointFromIJ', (): void => {
  it('should convert an Face-I-J of 0-0-0 to an XYZ point', (): void => {
    expect(pointFromIJ(0, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert an Face-I-J of 1-0-0 to an XYZ point', (): void => {
    expect(pointFromIJ(1, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: 0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert an Face-I-J of 2-20-100 to an XYZ point', (): void => {
    expect(pointFromIJ(2, 20, 100)).toEqual({
      x: 0.5773502978669214,
      y: 0.577350183157724,
      z: 0.577350326544222,
    });
  });
});

describe('pointFromLonLat', (): void => {
  it('should convert a lon/lat of 0-0 to an XYZ point', (): void => {
    expect(pointFromLonLat({ x: 0, y: 0 })).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('should convert a lon/lat of 90-0 to an XYZ point', (): void => {
    expect(pointFromLonLat({ x: 90, y: 0 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: 1,
      z: 0,
    });
  });
  it('should convert a lon/lat of 0-90 to an XYZ point', (): void => {
    expect(pointFromLonLat({ x: 0, y: 90 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: 0,
      z: 1,
    });
  });
});

describe('pointFromLonLatGL', (): void => {
  it('should convert a lon/lat of 0-0 to an XYZ point', (): void => {
    expect(pointFromLonLatGL({ x: 0, y: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });
  it('should convert a lon/lat of 90-0 to an XYZ point', (): void => {
    expect(pointFromLonLatGL({ x: 90, y: 0 })).toEqual({
      x: 1,
      y: 0,
      z: 0.00000000000000006123233995736766,
    });
  });
  it('should convert a lon/lat of 0-90 to an XYZ point', (): void => {
    expect(pointFromLonLatGL({ x: 0, y: 90 })).toEqual({
      x: 0,
      y: 1,
      z: 0.00000000000000006123233995736766,
    });
  });
});

// pointFromS2CellID
describe('pointFromS2CellID', (): void => {
  it('should convert a S2CellID of 0n to an XYZ point', (): void => {
    expect(pointFromS2CellID(0n)).toEqual({
      x: 0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a S2CellID of 1n to an XYZ point', (): void => {
    expect(pointFromS2CellID(1n)).toEqual({
      x: 0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a S2CellID of 2n to an XYZ point', (): void => {
    expect(pointFromS2CellID(2n)).toEqual({
      x: 0.5773502696675807,
      y: -0.5773502682337158,
      z: -0.5773502696675807,
    });
  });
  it('should convert a S2CellID of 12345678n to an XYZ point', (): void => {
    expect(pointFromS2CellID(12345678n)).toEqual({
      x: 0.5773521480306643,
      y: -0.5773512102802507,
      z: -0.5773474492472517,
    });
  });
});

describe('pointFromST', (): void => {
  it('should convert a Face-S-T of 0-0-0 to an XYZ point', (): void => {
    expect(pointFromST(0, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 1-0-0 to an XYZ point', (): void => {
    expect(pointFromST(1, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: 0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 2-0-0 to an XYZ point', (): void => {
    expect(pointFromST(2, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: 0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 3-0-0 to an XYZ point', (): void => {
    expect(pointFromST(3, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: 0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 4-0-0 to an XYZ point', (): void => {
    expect(pointFromST(4, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: -0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 5-0-0 to an XYZ point', (): void => {
    expect(pointFromST(5, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
});

describe('pointFromSTGL', (): void => {
  it('should convert a Face-S-T of 0-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(0, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: -0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 1-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(1, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: -0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 2-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(2, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: 0.5773502691896258,
      z: 0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 3-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(3, 0, 0)).toEqual({
      x: 0.5773502691896258,
      y: 0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 4-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(4, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: 0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
  it('should convert a Face-S-T of 5-0-0 to an XYZ point', (): void => {
    expect(pointFromSTGL(5, 0, 0)).toEqual({
      x: -0.5773502691896258,
      y: -0.5773502691896258,
      z: -0.5773502691896258,
    });
  });
});

describe('pointFromUV', (): void => {
  it('should convert a Face-U-V of 0-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(0, 0, 0)).toEqual({ x: 1, y: 0, z: 0 });
  });
  it('should convert a Face-U-V of 1-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(1, 0, 0)).toEqual({ x: -0, y: 1, z: 0 });
  });
  it('should convert a Face-U-V of 2-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(2, 0, 0)).toEqual({ x: -0, y: -0, z: 1 });
  });
  it('should convert a Face-U-V of 3-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(3, 0, 0)).toEqual({ x: -1, y: -0, z: -0 });
  });
  it('should convert a Face-U-V of 4-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(4, 0, 0)).toEqual({ x: 0, y: -1, z: -0 });
  });
  it('should convert a Face-U-V of 5-0-0 to an XYZ point', (): void => {
    expect(pointFromUV(5, 0, 0)).toEqual({ x: 0, y: 0, z: -1 });
  });
});

describe('pointFromUVGL', (): void => {
  it('should convert a Face-U-V of 0-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(0, 0, 0)).toEqual({ x: 0, y: 0, z: 1 });
  });
  it('should convert a Face-U-V of 1-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(1, 0, 0)).toEqual({ x: 1, y: 0, z: -0 });
  });
  it('should convert a Face-U-V of 2-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(2, 0, 0)).toEqual({ x: -0, y: 1, z: -0 });
  });
  it('should convert a Face-U-V of 3-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(3, 0, 0)).toEqual({ x: -0, y: -0, z: -1 });
  });
  it('should convert a Face-U-V of 4-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(4, 0, 0)).toEqual({ x: -1, y: -0, z: 0 });
  });
  it('should convert a Face-U-V of 5-0-0 to an XYZ point', (): void => {
    expect(pointFromUVGL(5, 0, 0)).toEqual({ x: 0, y: -1, z: 0 });
  });
});

describe('pointGetFace', (): void => {
  it('should return the face of an XYZ point', (): void => {
    expect(pointGetFace({ x: 1, y: 0, z: 0 })).toEqual(0);
    expect(pointGetFace({ x: 0, y: 1, z: 0 })).toEqual(1);
    expect(pointGetFace({ x: 0, y: 0, z: 1 })).toEqual(2);
    expect(pointGetFace({ x: -1, y: 0, z: 0 })).toEqual(3);
    expect(pointGetFace({ x: 0, y: -1, z: 0 })).toEqual(4);
    expect(pointGetFace({ x: 0, y: 0, z: -1 })).toEqual(5);
    expect(pointGetFace({ x: 0.5, y: 0.5, z: 0.5 })).toEqual(2);
  });
});

describe('pointLength', (): void => {
  it('should calculate the pointLength of an XYZ point', (): void => {
    expect(pointLength({ x: 1, y: 2, z: 3 })).toBeCloseTo(3.7416573867739413);
  });
});

describe('pointNormalize', (): void => {
  it('should pointNormalize an XYZ point', (): void => {
    expect(pointNormalize({ x: 1, y: 2, z: 3 })).toEqual({
      x: 0.2672612419124244,
      y: 0.5345224838248488,
      z: 0.8017837257372732,
    });
  });
});

describe('pointSubScalar', (): void => {
  it('should pointSubtract 1 from each component of an XYZ point', (): void => {
    expect(pointSubScalar({ x: 1, y: 2, z: 3 }, 1)).toEqual({ x: 0, y: 1, z: 2 });
  });
});

describe('pointSub', (): void => {
  it('should pointSubtract an XYZ point from another XYZ point', (): void => {
    expect(pointSub({ x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3 })).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('pointToIJ', (): void => {
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(
      pointToIJ({ x: 0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual([5, 0, 1073741823]);
  });
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(
      pointToIJ({ x: 0.5773502691896258, y: 0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual([5, 1073741823, 1073741823]);
  });
  it('should convert an XYZ point to a Face-I-J', (): void => {
    expect(pointToIJ({ x: 0.9999999503294631, y: 0.9999997516473249, z: 1 })).toEqual([2, 20, 100]);
  });
  it('should convert an XYZ point to a Face-I-J including a level of 10', (): void => {
    expect(
      pointToIJ({ x: 0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 }, 10),
    ).toEqual([5, 0, 1023]);
  });
});

describe('pointToLonLat', (): void => {
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(pointToLonLat({ x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
  });
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(pointToLonLat({ x: 0.00000000000000006123233995736766, y: 1, z: 0 })).toEqual({
      x: 90,
      y: 0,
    });
  });
  it('should convert an XYZ point to a lon/lat', (): void => {
    expect(pointToLonLat({ x: 0.00000000000000006123233995736766, y: 0, z: 1 })).toEqual({
      x: 0,
      y: 90,
    });
  });
});

describe('pointToS2CellID', (): void => {
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(
      pointToS2CellID({ x: 0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual(13835058055282163711n);
  });
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(
      pointToS2CellID({ x: 0.5773502691896258, y: 0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual(13066443718877599061n);
  });
  it('should convert an XYZ point to a S2CellID', (): void => {
    expect(pointToS2CellID({ x: 0.9999999503294631, y: 0.9999997516473249, z: 1 })).toEqual(
      4611686018427419201n,
    );
  });
});

describe('pointToST', (): void => {
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: 0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual([5, 0, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: 0.5773502691896258, y: 0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual([5, 1, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: 0.5773502691896258, y: 0.5773502691896258, z: 0.5773502691896258 }),
    ).toEqual([2, 0, 0]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: -0.5773502691896258, y: 0.5773502691896258, z: 0.5773502691896258 }),
    ).toEqual([2, 1, 0]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: -0.5773502691896258, y: -0.5773502691896258, z: 0.5773502691896258 }),
    ).toEqual([2, 1, 1]);
  });
  it('should convert an XYZ point to a Face-S-T', (): void => {
    expect(
      pointToST({ x: -0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 }),
    ).toEqual([5, 0, 0]);
  });
});

describe('pointToUV', (): void => {
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: 1, y: 0, z: 0 })).toEqual([0, 0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: 0, y: 1, z: 0 })).toEqual([1, -0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: 0, y: 0, z: 1 })).toEqual([2, -0, -0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: -1, y: 0, z: 0 })).toEqual([3, -0, -0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: 0, y: -1, z: 0 })).toEqual([4, -0, 0]);
  });
  it('should convert an XYZ point to a Face-U-V', (): void => {
    expect(pointToUV({ x: 0, y: 0, z: -1 })).toEqual([5, 0, 0]);
  });
});

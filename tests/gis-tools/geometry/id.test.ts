import {
  compareIDs,
  idBoundsST,
  idCenterST,
  idChild,
  idChildPosition,
  idChildren,
  idChildrenIJ,
  idContains,
  idContainsS2Point,
  idDistance,
  idFace,
  idFromDistance,
  idFromFace,
  idFromFacePosLevel,
  idFromIJ,
  idFromIJSame,
  idFromIJWrap,
  idFromLonLat,
  idFromS2Point,
  idFromST,
  idFromUV,
  idGetBoundUV,
  idGetEdges,
  idGetEdgesRaw,
  idGetVertices,
  idGetVerticesRaw,
  idIntersects,
  idIsFace,
  idIsLeaf,
  idLevel,
  idNeighbors,
  idNeighborsIJ,
  idNext,
  idParent,
  idPos,
  idPrev,
  idRange,
  idSizeST,
  idToFaceIJ,
  idToIJ,
  idToLonLat,
  idToS2Point,
  idToST,
  idToUV,
  idVertexNeighbors,
} from '../../../s2/gis-tools/geometry/id';

import { describe, expect, it } from 'bun:test';

// Helpers
import { pointFromLonLat } from '../../../s2/gis-tools/geometry/s2/point';

describe('idBoundsST', () => {
  it('should return the bounds for a given id and level', () => {
    expect(idBoundsST(idFromFace(0), 0)).toEqual([0, 0, 1, 1]);
    expect(idBoundsST(idFromFace(0), 1)).toEqual([0.25, 0.25, 0.75, 0.75]);
    expect(idBoundsST(idFromFace(0), 2)).toEqual([0.375, 0.375, 0.625, 0.625]);
    expect(idBoundsST(idFromFace(1), 0)).toEqual([0, 0, 1, 1]);
  });
});

describe('idCenterST', () => {
  it('should return the center for a given id and level', () => {
    expect(idCenterST(idFromFace(0))).toEqual([0, 0.5, 0.5]);
    expect(idCenterST(idFromFace(1))).toEqual([1, 0.5, 0.5]);
    expect(idCenterST(idFromFace(2))).toEqual([2, 0.5, 0.5]);
    expect(idCenterST(idFromFace(3))).toEqual([3, 0.5, 0.5]);
  });
});

describe('idChild', () => {
  it('should return the idChild cell', () => {
    expect(idChild(idFromFace(0), 0n)).toEqual(288230376151711744n);
    expect(idChild(idFromFace(0), 1n)).toEqual(864691128455135232n);
    expect(idChild(idFromFace(0), 2n)).toEqual(1441151880758558720n);
    expect(idChild(idFromFace(0), 3n)).toEqual(2017612633061982208n);
  });
});

describe('idChildPosition', () => {
  it('should return the idChild position', () => {
    expect(idChildPosition(idFromFace(0), 0)).toEqual(0);
    expect(idChildPosition(idFromFace(0), 1)).toEqual(2);
    expect(idChildPosition(idFromFace(0), 2)).toEqual(0);
    expect(idChildPosition(idFromFace(1), 0)).toEqual(1);
    expect(idChildPosition(idChild(idFromFace(0), 1n), 1)).toEqual(1);
  });
});

describe('idChildren', () => {
  it('should return the idChildren cells', () => {
    expect(idChildren(idFromFace(0))).toEqual([
      288230376151711744n,
      864691128455135232n,
      1441151880758558720n,
      2017612633061982208n,
    ]);
  });
});

describe('idChildrenIJ', () => {
  it('should return the idChildren cells', () => {
    expect(idChildrenIJ(0, 0, 0, 0)).toEqual([
      288230376151711744n,
      2017612633061982208n,
      864691128455135232n,
      1441151880758558720n,
    ]);
  });
});

describe('idContains', () => {
  it('should return if the cell idContains the given cell', () => {
    expect(idContains(idFromFace(0), idFromFace(0))).toEqual(true);
    expect(idContains(idFromFace(0), idFromFace(1))).toEqual(false);
    expect(idContains(idFromFace(0), idChild(idFromFace(0), 1n))).toEqual(true);
  });
});

describe('idDistance', () => {
  it('should return the idDistance between two cells', () => {
    expect(idDistance(idFromFace(0), 0)).toEqual(0n);
    expect(idDistance(idFromFace(0), 1)).toEqual(2n);
    expect(idDistance(idFromFace(0), 2)).toEqual(8n);
    expect(idDistance(idFromFace(0), 3)).toEqual(32n);
  });
});

describe('idFace', () => {
  it('should return the face for a given cell', () => {
    expect(idFace(idFromFace(0))).toEqual(0);
    expect(idFace(idFromFace(1))).toEqual(1);
    expect(idFace(idFromFace(2))).toEqual(2);
    expect(idFace(idFromFace(3))).toEqual(3);
    expect(idFace(idFromFace(4))).toEqual(4);
    expect(idFace(idFromFace(5))).toEqual(5);
  });
});

describe('idFromDistance', () => {
  it('should return the cell id for a given idDistance', () => {
    expect(idFromDistance(0n)).toEqual(1n);
    expect(idFromDistance(1n)).toEqual(3n);
    expect(idFromDistance(2n)).toEqual(5n);
    expect(idFromDistance(3n)).toEqual(7n);
    expect(idFromDistance(4n)).toEqual(9n);
    expect(idFromDistance(5n)).toEqual(11n);
  });
});

describe('idFromFace', () => {
  it('should return the cell id for a given face', () => {
    expect(idFromFace(0)).toEqual(1152921504606846976n);
    expect(idFromFace(1)).toEqual(3458764513820540928n);
    expect(idFromFace(2)).toEqual(5764607523034234880n);
    expect(idFromFace(3)).toEqual(8070450532247928832n);
    expect(idFromFace(4)).toEqual(10376293541461622784n);
    expect(idFromFace(5)).toEqual(12682136550675316736n);
  });
});

describe('idFromFacePosLevel', () => {
  it('should return the cell id for a given face, position, and level', () => {
    expect(idFromFacePosLevel(0, 0n, 0)).toEqual(1152921504606846976n);
    expect(idFromFacePosLevel(1, 0n, 0)).toEqual(3458764513820540928n);
    expect(idFromFacePosLevel(2, 0n, 0)).toEqual(5764607523034234880n);
    expect(idFromFacePosLevel(3, 0n, 0)).toEqual(8070450532247928832n);
    expect(idFromFacePosLevel(4, 0n, 0)).toEqual(10376293541461622784n);
    expect(idFromFacePosLevel(5, 0n, 0)).toEqual(12682136550675316736n);
  });

  it('zoom 1', () => {
    expect(idFromFacePosLevel(0, 0n, 1)).toEqual(288230376151711744n);
    expect(idFromFacePosLevel(0, 1n, 1)).toEqual(288230376151711744n);
    expect(idFromFacePosLevel(0, 2n, 1)).toEqual(288230376151711744n);
    expect(idFromFacePosLevel(0, 3n, 1)).toEqual(288230376151711744n);
  });
});

describe('idFromIJ', () => {
  it('should return the cell id for a given i-j', () => {
    expect(idFromIJ(0, 0, 0)).toEqual(1n);
    expect(idFromIJ(0, 1, 0)).toEqual(3n);
    expect(idFromIJ(0, 1, 1)).toEqual(5n);
    expect(idFromIJ(0, 0, 1)).toEqual(7n);
  });
});

describe('idFromIJSame', () => {
  it('should return the cell id for a given i-j', () => {
    expect(idFromIJSame(0, 0, 0, true)).toEqual(1n);
    expect(idFromIJSame(0, 1, 0, true)).toEqual(3n);
    expect(idFromIJSame(0, 1, 1, true)).toEqual(5n);
    expect(idFromIJSame(0, 0, 1, true)).toEqual(7n);
  });
});

describe('idFromIJWrap', () => {
  it('should return the cell id for a given i-j', () => {
    expect(idFromIJWrap(0, 0, 0)).toEqual(1n);
    expect(idFromIJWrap(0, 1, 0)).toEqual(3n);
    expect(idFromIJWrap(0, 1, 1)).toEqual(5n);
    expect(idFromIJWrap(0, 0, 1)).toEqual(7n);
  });
});

describe('idFromLonLat', () => {
  it('should return the cell id for a given lon-lat', () => {
    expect(idFromLonLat({ x: 0, y: 0 })).toEqual(1152921504606846977n);
    expect(idFromLonLat({ x: 90, y: 0 })).toEqual(3458764513820540929n);
    expect(idFromLonLat({ x: 0, y: 90 })).toEqual(5764607523034234881n);
    expect(idFromLonLat({ x: -90, y: 0 })).toEqual(10376293541461622785n);
    expect(idFromLonLat({ x: 0, y: -90 })).toEqual(12682136550675316737n);
  });
});

describe('idFromS2Point', () => {
  it('should return the cell id for a given s2 point', () => {
    expect(idFromS2Point({ x: 1, y: 0, z: 0 })).toEqual(1152921504606846977n);
    expect(idFromS2Point({ x: 0, y: 1, z: 0 })).toEqual(3458764513820540929n);
    expect(idFromS2Point({ x: 0, y: 0, z: 1 })).toEqual(5764607523034234881n);
    expect(idFromS2Point({ x: -1, y: 0, z: 0 })).toEqual(8070450532247928833n);
    expect(idFromS2Point({ x: 0, y: -1, z: 0 })).toEqual(10376293541461622785n);
    expect(idFromS2Point({ x: 0, y: 0, z: -1 })).toEqual(12682136550675316737n);
  });
});

describe('idFromST', () => {
  it('should return the cell id for a given a Face-S-T', () => {
    expect(idFromST(0, 0, 0)).toEqual(1n);
    expect(idFromST(0, 1, 0)).toEqual(2305843009213693951n);
    expect(idFromST(0, 0, 1)).toEqual(768614336404564651n);
    expect(idFromST(0, 0.5, 0.5)).toEqual(1152921504606846977n);
    expect(idFromST(0, 1, 1)).toEqual(1537228672809129301n);
  });
});

describe('idFromUV', () => {
  it('should return the cell id for a given a Face-U-V', () => {
    expect(idFromUV(0, 0, 0)).toEqual(1152921504606846977n);
    expect(idFromUV(0, 1, 0)).toEqual(1729382256910270463n);
    expect(idFromUV(0, 0, 1)).toEqual(1345075088707988139n);
    expect(idFromUV(0, -1, 0)).toEqual(576460752303423489n);
    expect(idFromUV(0, 0, -1)).toEqual(2113689425112552789n);
  });
});

describe('idIntersects', () => {
  it('should return if the cell idIntersects the given cell', () => {
    expect(idIntersects(idFromFace(0), idFromFace(0))).toEqual(true);
    expect(idIntersects(idFromFace(0), idFromFace(1))).toEqual(false);
    expect(idIntersects(idFromFace(0), idChild(idFromFace(0), 1n))).toEqual(true);
  });
});

describe('idIsFace', () => {
  it('should return if the cell is a face', () => {
    expect(idIsFace(1152921504606846976n)).toEqual(true);
    expect(idIsFace(1152921504606846977n)).toEqual(false);
  });
});

describe('idIsLeaf', () => {
  it('should return if the cell is a leaf', () => {
    expect(idIsLeaf(1152921504606846976n)).toEqual(false);
    expect(idIsLeaf(1152921504606846977n)).toEqual(true);
  });
});

describe('idLevel', () => {
  it('should return the level for a given cell', () => {
    expect(idLevel(1152921504606846976n)).toEqual(0);
    expect(idLevel(1152921504606846977n)).toEqual(30);
  });
});

describe('idNeighbors', () => {
  it('should return the idNeighbors cells', () => {
    expect(idNeighbors(idFromFace(0))).toEqual([
      12682136550675316736n,
      3458764513820540928n,
      5764607523034234880n,
      10376293541461622784n,
    ]);
  });
});

describe('idNeighborsIJ', () => {
  it('should return the idNeighbors cells', () => {
    expect(idNeighborsIJ(0, 0, 0, 0)).toEqual([
      12682136550675316736n,
      3458764513820540928n,
      5764607523034234880n,
      10376293541461622784n,
    ]);
  });
});

describe('idNext', () => {
  it('should return the next cell', () => {
    expect(idNext(idFromFace(0))).toEqual(3458764513820540928n);
    expect(idNext(idFromFace(1))).toEqual(5764607523034234880n);
    expect(idNext(idFromFace(2))).toEqual(8070450532247928832n);
    expect(idNext(idFromFace(3))).toEqual(10376293541461622784n);
  });
});

describe('idParent', () => {
  it('should return the idParent cell', () => {
    expect(idParent(idChild(idFromFace(0), 0n))).toEqual(idFromFace(0));
  });
});

describe('idPos', () => {
  it('should return the position for a given cell', () => {
    expect(idPos(idFromFace(0))).toEqual(1152921504606846976n);
    expect(idPos(idFromFace(1))).toEqual(1152921504606846976n);
    expect(idPos(idFromFace(2))).toEqual(1152921504606846976n);
    expect(idPos(idFromFace(3))).toEqual(1152921504606846976n);
  });
});

describe('idPrev', () => {
  it('should return the idPrev cell', () => {
    expect(idPrev(idFromFace(1))).toEqual(1152921504606846976n);
    expect(idPrev(idFromFace(2))).toEqual(3458764513820540928n);
    expect(idPrev(idFromFace(3))).toEqual(5764607523034234880n);
    expect(idPrev(idFromFace(4))).toEqual(8070450532247928832n);
    expect(idPrev(idFromFace(5))).toEqual(10376293541461622784n);
  });
});

describe('idRange', () => {
  it('should return the idRange for a given level', () => {
    expect(idRange(0n)).toEqual([1n, -1n]);
    expect(idRange(1n)).toEqual([1n, 1n]);
    expect(idRange(idFromFace(0))).toEqual([1n, 2305843009213693951n]);
  });
});

describe('idSizeST', () => {
  it('should return the size for a given level', () => {
    expect(idSizeST(0)).toEqual(1);
    expect(idSizeST(1)).toEqual(0.5);
    expect(idSizeST(2)).toEqual(0.25);
  });
});

describe('idToIJ', () => {
  it('should return the i-j for a given cell', () => {
    expect(idToIJ(0n)).toEqual([0, 0, 0, 0]);
    expect(idToIJ(idFromFace(0))).toEqual([0, 536870912, 536870912, 0]);
    expect(idToIJ(idFromFace(1))).toEqual([1, 536870912, 536870912, 1]);
    expect(idToIJ(idFromFace(2))).toEqual([2, 536870912, 536870912, 0]);
    expect(idToIJ(idFromFace(3))).toEqual([3, 536870912, 536870912, 1]);
  });
  it('also given a level, should return the i-j for a given cell', () => {
    expect(idToIJ(idFromFace(0), 0)).toEqual([0, 0, 0, 0]);
    expect(idToIJ(idFromFace(0), 1)).toEqual([0, 1, 1, 0]);
  });
});

describe('idToLonLat', () => {
  it('should return the lon-lat for a given cell', () => {
    expect(idToLonLat(idFromFace(0))).toEqual({ x: 0, y: 0 });
    expect(idToLonLat(idFromFace(1))).toEqual({ x: 90, y: 0 });
    expect(idToLonLat(idFromFace(2))).toEqual({ x: -180, y: 90 });
    expect(idToLonLat(idFromFace(3))).toEqual({ x: -180, y: -0 });
  });
});

describe('idToS2Point', () => {
  it('should return the s2 point for a given cell', () => {
    expect(idToS2Point(idFromFace(0))).toEqual({ x: 1, y: 0, z: 0 });
    expect(idToS2Point(idFromFace(1))).toEqual({ x: -0, y: 1, z: 0 });
    expect(idToS2Point(idFromFace(2))).toEqual({ x: -0, y: -0, z: 1 });
    expect(idToS2Point(idFromFace(3))).toEqual({ x: -1, y: -0, z: -0 });
  });
});

describe('idToST', () => {
  it('should return the s-t for a given cell', () => {
    expect(idToST(idFromFace(0))).toEqual([0, 0.5, 0.5]);
    expect(idToST(idFromFace(1))).toEqual([1, 0.5, 0.5]);
    expect(idToST(idFromFace(2))).toEqual([2, 0.5, 0.5]);
    expect(idToST(idFromFace(3))).toEqual([3, 0.5, 0.5]);
    expect(idToST(idChild(idFromFace(0), 0n))).toEqual([0, 0.25, 0.25]);
    expect(idToST(idChild(idFromFace(0), 1n))).toEqual([0, 0.25, 0.75]);
  });
});

describe('idToUV', () => {
  it('should return the u-v for a given cell', () => {
    expect(idToUV(idFromFace(0))).toEqual([0, 0, 0]);
    expect(idToUV(idFromFace(1))).toEqual([1, 0, 0]);
    expect(idToUV(idFromFace(2))).toEqual([2, 0, 0]);
    expect(idToUV(idFromFace(3))).toEqual([3, 0, 0]);
    expect(idToUV(idChild(idFromFace(0), 0n))).toEqual([
      0, -0.41666666666666663, -0.41666666666666663,
    ]);
    expect(idToUV(idChild(idFromFace(0), 1n))).toEqual([
      0, -0.41666666666666663, 0.41666666666666663,
    ]);
  });
});

describe('idVertexNeighbors', () => {
  it('should return the vertex idNeighbors for a given cell', () => {
    expect(idVertexNeighbors(idFromFace(0))).toEqual([
      1152921504606846976n,
      3458764513820540928n,
      5764607523034234880n,
    ]);
    expect(idVertexNeighbors(123974589433424n)).toEqual([
      123974589433424n,
      123974589433584n,
      123974589433776n,
      123974589433616n,
    ]);
  });
});

describe('idToFaceIJ', () => {
  const id = idToFaceIJ(0n);
  expect(id).toEqual([0, 0, 0, 0]);
});

describe('idContainsS2Point', () => {
  const face0 = idFromFace(0);
  const point = pointFromLonLat({ x: 0, y: 0 });
  const point2 = pointFromLonLat({ x: -160, y: 70 });
  expect(idContainsS2Point(face0, point)).toEqual(true);
  expect(idContainsS2Point(face0, point2)).toEqual(false);
});

describe('idGetBoundUV', () => {
  expect(idGetBoundUV(idFromFace(0))).toEqual([-1, 1, -1, 1]);
  expect(idGetBoundUV(idFromFace(1))).toEqual([-1, 1, -1, 1]);

  const [a, b, c, d] = idChildren(idFromFace(0));
  expect(idGetBoundUV(a)).toEqual([-1, 0, -1, 0]);
  expect(idGetBoundUV(b)).toEqual([-1, 0, 0, 1]);
  expect(idGetBoundUV(c)).toEqual([0, 1, 0, 1]);
  expect(idGetBoundUV(d)).toEqual([0, 1, -1, 0]);
});

describe('idGetEdgesRaw', () => {
  expect(idGetEdgesRaw(idFromFace(0))).toEqual([
    { x: 1, y: 0, z: 1 },
    { x: 1, y: -1, z: 0 },
    { x: 1, y: -0, z: -1 },
    { x: 1, y: 1, z: -0 },
  ]);

  const level10 = idFromIJ(0, 10, 20, 10);
  expect(idGetEdgesRaw(level10)).toEqual([
    { x: 0.94842529296875, y: 0, z: 1 },
    { x: -0.9715080261230469, y: -1, z: 0 },
    { x: -0.9458732604980469, y: -0, z: -1 },
    { x: 0.9740854899088541, y: 1, z: -0 },
  ]);
});

describe('idGetEdges', () => {
  expect(idGetEdges(idFromFace(0))).toEqual([
    { x: 0.7071067811865475, y: 0, z: 0.7071067811865475 },
    { x: 0.7071067811865475, y: -0.7071067811865475, z: 0 },
    { x: 0.7071067811865475, y: -0, z: -0.7071067811865475 },
    { x: 0.7071067811865475, y: 0.7071067811865475, z: -0 },
  ]);

  const level10 = idFromIJ(0, 10, 20, 10);
  expect(idGetEdges(level10)).toEqual([
    { x: 0.6881486685943737, y: 0, z: 0.7255697140260132 },
    { x: -0.696815003909965, y: -0.7172508977519342, z: 0 },
    { x: -0.6871719848800082, y: -0, z: -0.7264947785057162 },
    { x: 0.6977642240401561, y: 0.7163275002745871, z: -0 },
  ]);
});

describe('idGetVerticesRaw', () => {
  expect(idGetVerticesRaw(idFromFace(0))).toEqual([
    { x: 1, y: -1, z: -1 },
    { x: 1, y: 1, z: -1 },
    { x: 1, y: 1, z: 1 },
    { x: 1, y: -1, z: 1 },
  ]);

  const level10 = idFromIJ(0, 10, 20, 10);
  expect(idGetVerticesRaw(level10)).toEqual([
    { x: 1, y: -0.9740854899088541, z: -0.94842529296875 },
    { x: 1, y: -0.9715080261230469, z: -0.94842529296875 },
    { x: 1, y: -0.9715080261230469, z: -0.9458732604980469 },
    { x: 1, y: -0.9740854899088541, z: -0.9458732604980469 },
  ]);
});

describe('idGetVertices', () => {
  expect(idGetVertices(idFromFace(0))).toEqual([
    { x: 0.5773502691896258, y: -0.5773502691896258, z: -0.5773502691896258 },
    { x: 0.5773502691896258, y: 0.5773502691896258, z: -0.5773502691896258 },
    { x: 0.5773502691896258, y: 0.5773502691896258, z: 0.5773502691896258 },
    { x: 0.5773502691896258, y: -0.5773502691896258, z: 0.5773502691896258 },
  ]);

  const level10 = idFromIJ(0, 10, 20, 10);
  expect(idGetVertices(level10)).toEqual([
    { x: 0.5925201015153633, y: -0.5771652333654366, z: -0.5619610508695819 },
    { x: 0.5930423748666049, y: -0.5761454270139794, z: -0.5624563881257431 },
    { x: 0.593547171020095, y: -0.576635840528651, z: -0.5614203979121691 },
    { x: 0.5930235640377648, y: -0.5776556489032209, z: -0.5609251320685729 },
  ]);
});

describe('compareIDs', () => {
  expect(compareIDs(idFromFace(0), idFromFace(0))).toEqual(0);
  expect(compareIDs(idFromFace(0), idFromFace(1))).toEqual(-1);
  expect(compareIDs(idFromFace(1), idFromFace(0))).toEqual(1);
});

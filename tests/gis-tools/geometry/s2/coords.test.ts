import {
  IJtoST,
  K_LIMIT_IJ,
  STtoIJ,
  SiTiToST,
  XYZtoFace,
  XYZtoFaceUV,
  bboxST,
  bboxUV,
  faceUVtoXYZ,
  faceUVtoXYZGL,
  faceXYZGLtoUV,
  faceXYZtoUV,
  getNeighborsIJ,
  getUNorm,
  getVNorm,
  linearSTtoUV,
  linearUVtoST,
  lonLatToXYZ,
  lonLatToXYZGL,
  quadraticSTtoUV,
  quadraticUVtoST,
  tanSTtoUV,
  tanUVtoST,
  tileXYFromSTZoom,
  tileXYFromUVZoom,
  xyzToLonLat,
} from '../../../../s2/gis-tools/geometry/s2/coords';
import { describe, expect, it } from 'bun:test';

describe('IJtoST', () => {
  it('should convert any whole number to between [0, 1]', () => {
    expect(IJtoST(0)).toEqual(0);
    expect(IJtoST(1)).toEqual(1 / K_LIMIT_IJ);
    expect(IJtoST(K_LIMIT_IJ - 1)).toEqual(1 - 1 / K_LIMIT_IJ);
  });
});

describe('K_LIMIT_IJ', () => {
  it('should be a number', () => {
    expect(K_LIMIT_IJ).toEqual(1 << 30);
  });
});

describe('STtoIJ', () => {
  it('should convert any number between [0, 1] to a whole number', () => {
    expect(STtoIJ(0)).toEqual(0);
    expect(STtoIJ(1 / K_LIMIT_IJ)).toEqual(1);
    expect(STtoIJ(1 - 1 / K_LIMIT_IJ)).toEqual(K_LIMIT_IJ - 1);
  });
});

describe('SiTiToST', () => {
  it('should convert any number to between [0, 1]', () => {
    expect(SiTiToST(0)).toEqual(0);
    expect(SiTiToST(1)).toEqual(1 / 2_147_483_648);
    expect(SiTiToST(2_147_483_647)).toEqual(0.9999999995343387);
  });
});

describe('XYZtoFace', () => {
  it('should convert a XYZ to a face', () => {
    expect(XYZtoFace({ x: 1, y: 0, z: 0 })).toEqual(0);
    expect(XYZtoFace({ x: 0, y: 1, z: 0 })).toEqual(1);
    expect(XYZtoFace({ x: 0, y: 0, z: 1 })).toEqual(2);
    expect(XYZtoFace({ x: -1, y: 0, z: 0 })).toEqual(3);
    expect(XYZtoFace({ x: 0, y: -1, z: 0 })).toEqual(4);
    expect(XYZtoFace({ x: 0, y: 0, z: -1 })).toEqual(5);
  });
});

describe('XYZtoFaceUV', () => {
  it('should convert a XYZ to a face and UV', () => {
    expect(XYZtoFaceUV({ x: 1, y: 0, z: 0 })).toEqual([0, 0, 0]);
    expect(XYZtoFaceUV({ x: 0, y: 1, z: 0 })).toEqual([1, -0, 0]);
    expect(XYZtoFaceUV({ x: 0, y: 0, z: 1 })).toEqual([2, -0, -0]);
    expect(XYZtoFaceUV({ x: -1, y: 0, z: 0 })).toEqual([3, -0, -0]);
    expect(XYZtoFaceUV({ x: 0, y: -1, z: 0 })).toEqual([4, -0, 0]);
    expect(XYZtoFaceUV({ x: 0, y: 0, z: -1 })).toEqual([5, 0, 0]);
  });
});

describe('bboxST', () => {
  it('should convert a bbox to ST at 0-0-0', () => {
    expect(bboxST(0, 0, 0)).toEqual([0, 0, 1, 1]);
  });
  it('should convert a bbox to ST at 1-0-1', () => {
    expect(bboxST(1, 0, 1)).toEqual([0.5, 0, 1, 0.5]);
  });
  it('should convert a bbox to ST at 2-0-2', () => {
    expect(bboxST(2, 0, 2)).toEqual([0.5, 0, 0.75, 0.25]);
  });
});

describe('bboxUV', () => {
  it('should convert a bbox to UV at 0-0-0', () => {
    expect(bboxUV(0, 0, 0)).toEqual([-1, -1, 1, 1]);
  });
  it('should convert a bbox to UV at 1-0-1', () => {
    expect(bboxUV(1, 0, 1)).toEqual([0, -1, 1, 0]);
  });
  it('should convert a bbox to UV at 2-0-2', () => {
    expect(bboxUV(2, 0, 2)).toEqual([0, -1, 0.5, -0.5]);
  });
});

describe('faceUVtoXYZ', () => {
  it('should convert a face and UV to XYZ', () => {
    expect(faceUVtoXYZ(0, 0, 0)).toEqual({ x: 1, y: 0, z: 0 });
    expect(faceUVtoXYZ(1, 0, 0)).toEqual({ x: -0, y: 1, z: 0 });
    expect(faceUVtoXYZ(2, 0, 0)).toEqual({ x: -0, y: -0, z: 1 });
    expect(faceUVtoXYZ(3, 0, 0)).toEqual({ x: -1, y: -0, z: -0 });
    expect(faceUVtoXYZ(4, 0, 0)).toEqual({ x: 0, y: -1, z: -0 });
    expect(faceUVtoXYZ(5, 0, 0)).toEqual({ x: 0, y: 0, z: -1 });
  });
});

describe('faceUVtoXYZGL', () => {
  it('should convert a face and UV to XYZ', () => {
    expect(faceUVtoXYZGL(0, 0, 0)).toEqual({ x: 0, y: 0, z: 1 });
    expect(faceUVtoXYZGL(1, 0, 0)).toEqual({ x: 1, y: 0, z: -0 });
    expect(faceUVtoXYZGL(2, 0, 0)).toEqual({ x: -0, y: 1, z: -0 });
    expect(faceUVtoXYZGL(3, 0, 0)).toEqual({ x: -0, y: -0, z: -1 });
    expect(faceUVtoXYZGL(4, 0, 0)).toEqual({ x: -1, y: -0, z: 0 });
    expect(faceUVtoXYZGL(5, 0, 0)).toEqual({ x: 0, y: -1, z: 0 });
  });
});

describe('faceXYZGLtoUV', () => {
  it('should convert a face and XYZ to UV', () => {
    expect(faceXYZGLtoUV(0, { x: 0, y: 0, z: 1 })).toEqual([0, 0]);
    expect(faceXYZGLtoUV(1, { x: 1, y: 0, z: 0 })).toEqual([-0, 0]);
    expect(faceXYZGLtoUV(2, { x: 0, y: 1, z: 0 })).toEqual([-0, -0]);
    expect(faceXYZGLtoUV(3, { x: 0, y: 0, z: -1 })).toEqual([-0, -0]);
    expect(faceXYZGLtoUV(4, { x: -1, y: 0, z: 0 })).toEqual([-0, 0]);
    expect(faceXYZGLtoUV(5, { x: 0, y: -1, z: 0 })).toEqual([0, 0]);
  });
});

describe('faceXYZtoUV', () => {
  it('should convert a face and XYZ to UV', () => {
    expect(faceXYZtoUV(0, { x: 1, y: 0, z: 0 })).toEqual([0, 0]);
    expect(faceXYZtoUV(1, { x: 0, y: 1, z: 0 })).toEqual([-0, 0]);
    expect(faceXYZtoUV(2, { x: 0, y: 0, z: 1 })).toEqual([-0, -0]);
    expect(faceXYZtoUV(3, { x: -1, y: 0, z: 0 })).toEqual([-0, -0]);
    expect(faceXYZtoUV(4, { x: 0, y: -1, z: 0 })).toEqual([-0, 0]);
    expect(faceXYZtoUV(5, { x: 0, y: 0, z: -1 })).toEqual([0, 0]);
  });
});

describe('linearSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a linear fashion', () => {
    expect(linearSTtoUV(0)).toEqual(-1);
    expect(linearSTtoUV(0.5)).toEqual(0);
    expect(linearSTtoUV(1)).toEqual(1);
  });
});

describe('linearUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a linear fashion', () => {
    expect(linearUVtoST(-1)).toEqual(0);
    expect(linearUVtoST(0)).toEqual(0.5);
    expect(linearUVtoST(1)).toEqual(1);
  });
});

describe('lonLatToXYZ', () => {
  it('should convert a lon-lat to XYZ', () => {
    expect(lonLatToXYZ({ x: 0, y: 0 })).toEqual({ x: 1, y: 0, z: 0 });
    expect(lonLatToXYZ({ x: 90, y: 0 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: 1,
      z: 0,
    });
    expect(lonLatToXYZ({ x: 0, y: 90 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: 0,
      z: 1,
    });
    expect(lonLatToXYZ({ x: -90, y: 0 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: -1,
      z: 0,
    });
    expect(lonLatToXYZ({ x: 0, y: -90 })).toEqual({
      x: 0.00000000000000006123233995736766,
      y: 0,
      z: -1,
    });
    expect(lonLatToXYZ({ x: 0, y: 0 })).toEqual({ x: 1, y: 0, z: 0 });
  });
});

describe('lonLatToXYZGL', () => {
  it('should convert a lon-lat to XYZ', () => {
    expect(lonLatToXYZGL({ x: 0, y: 0 })).toEqual({ x: 0, y: 0, z: 1 });
    expect(lonLatToXYZGL({ x: 90, y: 0 })).toEqual({
      x: 1,
      y: 0,
      z: 0.00000000000000006123233995736766,
    });
    expect(lonLatToXYZGL({ x: 0, y: 90 })).toEqual({
      x: 0,
      y: 1,
      z: 0.00000000000000006123233995736766,
    });
    expect(lonLatToXYZGL({ x: -90, y: 0 })).toEqual({
      x: -1,
      y: 0,
      z: 0.00000000000000006123233995736766,
    });
    expect(lonLatToXYZGL({ x: 0, y: -90 })).toEqual({
      x: 0,
      y: -1,
      z: 0.00000000000000006123233995736766,
    });
    expect(lonLatToXYZGL({ x: 0, y: 0 })).toEqual({ x: 0, y: 0, z: 1 });
  });
});

describe('getNeighborsIJ', () => {
  it('should take a Face-I-J and find its neighbors', () => {
    expect(getNeighborsIJ(0, 0, 0)).toEqual([
      [5, 0, 1073741823],
      [0, 1, 0],
      [0, 0, 1],
      [4, 1073741823, 1073741823],
    ]);
  });

  it('should take a Face-I-J and find its neighbors given a level', () => {
    expect(getNeighborsIJ(0, 1, 1, 3)).toEqual([
      [0, 1, 0],
      [0, 2, 1],
      [0, 1, 2],
      [0, 0, 1],
    ]);
  });
});

describe('quadraticSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a quadratic fashion', () => {
    expect(quadraticSTtoUV(0)).toEqual(-1);
    expect(quadraticSTtoUV(0.5)).toEqual(0);
    expect(quadraticSTtoUV(1)).toEqual(1);
  });
});

describe('quadraticUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a quadratic fashion', () => {
    expect(quadraticUVtoST(-1)).toEqual(0);
    expect(quadraticUVtoST(0)).toEqual(0.5);
    expect(quadraticUVtoST(1)).toEqual(1);
  });
});

describe('tanSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a tangential fashion', () => {
    expect(tanSTtoUV(0)).toEqual(-0.9999999999999999);
    expect(tanSTtoUV(0.5)).toEqual(0);
    expect(tanSTtoUV(1)).toEqual(0.9999999999999999);
  });
});

describe('tanUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a tangential fashion', () => {
    expect(tanUVtoST(-1)).toEqual(0);
    expect(tanUVtoST(0)).toEqual(0.5);
    expect(tanUVtoST(1)).toEqual(1);
  });
});

describe('tileXYFromSTZoom', () => {
  it('should convert an ST to a tile coordinate', () => {
    expect(tileXYFromSTZoom(0, 0, 0)).toEqual([0, 0]);
    expect(tileXYFromSTZoom(0.5, 0, 1)).toEqual([1, 0]);
    expect(tileXYFromSTZoom(0.5, 0.5, 2)).toEqual([2, 2]);
  });
});

describe('tileXYFromUVZoom', () => {
  it('should convert a UV to a tile coordinate', () => {
    expect(tileXYFromUVZoom(-1, -1, 0)).toEqual([0, 0]);
    expect(tileXYFromUVZoom(0, -1, 1)).toEqual([1, 0]);
    expect(tileXYFromUVZoom(0, 0, 2)).toEqual([2, 2]);
  });
});

describe('xyzToLonLat', () => {
  it('should convert a XYZ to lon-lat', () => {
    expect(xyzToLonLat({ x: 1, y: 0, z: 0 })).toEqual({ x: 0, y: 0 });
    expect(xyzToLonLat({ x: 0, y: 1, z: 0 })).toEqual({ x: 90, y: 0 });
    expect(xyzToLonLat({ x: 0, y: 0, z: 1 })).toEqual({ x: 0, y: 90 });
    expect(xyzToLonLat({ x: -1, y: 0, z: 0 })).toEqual({ x: 180, y: 0 });
    expect(xyzToLonLat({ x: 0, y: -1, z: 0 })).toEqual({ x: -90, y: 0 });
    expect(xyzToLonLat({ x: 0, y: 0, z: -1 })).toEqual({ x: 0, y: -90 });
  });
});

describe('getUNorm', () => {
  expect(getUNorm(0, -1)).toEqual({ x: -1, y: -1, z: 0 });
  expect(getUNorm(0, 1)).toEqual({ x: 1, y: -1, z: 0 });
  // just test faces now
  expect(getUNorm(1, 0)).toEqual({ x: 1, y: 0, z: 0 });
  expect(getUNorm(2, 0)).toEqual({ x: 1, y: 0, z: 0 });
  expect(getUNorm(3, 0)).toEqual({ x: -0, y: 0, z: 1 });
  expect(getUNorm(4, 0)).toEqual({ x: 0, y: -0, z: 1 });
  expect(getUNorm(5, 0)).toEqual({ x: 0, y: -1, z: -0 });
});

describe('getVNorm', () => {
  expect(getVNorm(0, -1)).toEqual({ x: 1, y: 0, z: 1 });
  expect(getVNorm(0, 1)).toEqual({ x: -1, y: 0, z: 1 });
  // just test faces now
  expect(getVNorm(1, 0)).toEqual({ x: 0, y: -0, z: 1 });
  expect(getVNorm(2, 0)).toEqual({ x: 0, y: -1, z: -0 });
  expect(getVNorm(3, 0)).toEqual({ x: 0, y: -1, z: 0 });
  expect(getVNorm(4, 0)).toEqual({ x: 1, y: 0, z: 0 });
  expect(getVNorm(5, 0)).toEqual({ x: 1, y: 0, z: 0 });
});

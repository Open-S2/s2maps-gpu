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
  linearSTtoUV,
  linearUVtoST,
  lonLatToXYZ,
  lonLatToXYZGL,
  neighborsIJ,
  quadraticSTtoUV,
  quadraticUVtoST,
  tanSTtoUV,
  tanUVtoST,
  tileXYFromSTZoom,
  tileXYFromUVZoom,
  xyzToLonLat,
} from 'geometry/s2/s2Coords';
import { describe, expect, it } from 'bun:test';

describe('IJtoST', () => {
  it('should convert any whole number to between [0, 1]', () => {
    expect(IJtoST(0)).toBe(0);
    expect(IJtoST(1)).toBe(1 / K_LIMIT_IJ);
    expect(IJtoST(K_LIMIT_IJ - 1)).toBe(1 - 1 / K_LIMIT_IJ);
  });
});

describe('K_LIMIT_IJ', () => {
  it('should be a number', () => {
    expect(K_LIMIT_IJ).toBe(1 << 30);
  });
});

describe('STtoIJ', () => {
  it('should convert any number between [0, 1] to a whole number', () => {
    expect(STtoIJ(0)).toBe(0);
    expect(STtoIJ(1 / K_LIMIT_IJ)).toBe(1);
    expect(STtoIJ(1 - 1 / K_LIMIT_IJ)).toBe(K_LIMIT_IJ - 1);
  });
});

describe('SiTiToST', () => {
  it('should convert any number to between [0, 1]', () => {
    expect(SiTiToST(0)).toBe(0);
    expect(SiTiToST(1)).toBe(1 / 2_147_483_648);
    expect(SiTiToST(2_147_483_647)).toBe(0.9999999995343387);
  });
});

describe('XYZtoFace', () => {
  it('should convert a XYZ to a face', () => {
    expect(XYZtoFace([1, 0, 0])).toBe(0);
    expect(XYZtoFace([0, 1, 0])).toBe(1);
    expect(XYZtoFace([0, 0, 1])).toBe(2);
    expect(XYZtoFace([-1, 0, 0])).toBe(3);
    expect(XYZtoFace([0, -1, 0])).toBe(4);
    expect(XYZtoFace([0, 0, -1])).toBe(5);
  });
});

describe('XYZtoFaceUV', () => {
  it('should convert a XYZ to a face and UV', () => {
    expect(XYZtoFaceUV([1, 0, 0])).toEqual([0, 0, 0]);
    expect(XYZtoFaceUV([0, 1, 0])).toEqual([1, -0, 0]);
    expect(XYZtoFaceUV([0, 0, 1])).toEqual([2, -0, -0]);
    expect(XYZtoFaceUV([-1, 0, 0])).toEqual([3, -0, -0]);
    expect(XYZtoFaceUV([0, -1, 0])).toEqual([4, -0, 0]);
    expect(XYZtoFaceUV([0, 0, -1])).toEqual([5, 0, 0]);
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
    expect(faceUVtoXYZ(0, 0, 0)).toEqual([1, 0, 0]);
    expect(faceUVtoXYZ(1, 0, 0)).toEqual([-0, 1, 0]);
    expect(faceUVtoXYZ(2, 0, 0)).toEqual([-0, -0, 1]);
    expect(faceUVtoXYZ(3, 0, 0)).toEqual([-1, -0, -0]);
    expect(faceUVtoXYZ(4, 0, 0)).toEqual([0, -1, -0]);
    expect(faceUVtoXYZ(5, 0, 0)).toEqual([0, 0, -1]);
  });
});

describe('faceUVtoXYZGL', () => {
  it('should convert a face and UV to XYZ', () => {
    expect(faceUVtoXYZGL(0, 0, 0)).toEqual([0, 0, 1]);
    expect(faceUVtoXYZGL(1, 0, 0)).toEqual([1, 0, -0]);
    expect(faceUVtoXYZGL(2, 0, 0)).toEqual([-0, 1, -0]);
    expect(faceUVtoXYZGL(3, 0, 0)).toEqual([-0, -0, -1]);
    expect(faceUVtoXYZGL(4, 0, 0)).toEqual([-1, -0, 0]);
    expect(faceUVtoXYZGL(5, 0, 0)).toEqual([0, -1, 0]);
  });
});

describe('faceXYZGLtoUV', () => {
  it('should convert a face and XYZ to UV', () => {
    expect(faceXYZGLtoUV(0, [0, 0, 1])).toEqual([0, 0]);
    expect(faceXYZGLtoUV(1, [1, 0, 0])).toEqual([-0, 0]);
    expect(faceXYZGLtoUV(2, [0, 1, 0])).toEqual([-0, -0]);
    expect(faceXYZGLtoUV(3, [0, 0, -1])).toEqual([-0, -0]);
    expect(faceXYZGLtoUV(4, [-1, 0, 0])).toEqual([-0, 0]);
    expect(faceXYZGLtoUV(5, [0, -1, 0])).toEqual([0, 0]);
  });
});

describe('faceXYZtoUV', () => {
  it('should convert a face and XYZ to UV', () => {
    expect(faceXYZtoUV(0, [1, 0, 0])).toEqual([0, 0]);
    expect(faceXYZtoUV(1, [0, 1, 0])).toEqual([-0, 0]);
    expect(faceXYZtoUV(2, [0, 0, 1])).toEqual([-0, -0]);
    expect(faceXYZtoUV(3, [-1, 0, 0])).toEqual([-0, -0]);
    expect(faceXYZtoUV(4, [0, -1, 0])).toEqual([-0, 0]);
    expect(faceXYZtoUV(5, [0, 0, -1])).toEqual([0, 0]);
  });
});

describe('linearSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a linear fashion', () => {
    expect(linearSTtoUV(0)).toBe(-1);
    expect(linearSTtoUV(0.5)).toBe(0);
    expect(linearSTtoUV(1)).toBe(1);
  });
});

describe('linearUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a linear fashion', () => {
    expect(linearUVtoST(-1)).toBe(0);
    expect(linearUVtoST(0)).toBe(0.5);
    expect(linearUVtoST(1)).toBe(1);
  });
});

describe('lonLatToXYZ', () => {
  it('should convert a lon-lat to XYZ', () => {
    expect(lonLatToXYZ(0, 0)).toEqual([1, 0, 0]);
    expect(lonLatToXYZ(90, 0)).toEqual([0.00000000000000006123233995736766, 1, 0]);
    expect(lonLatToXYZ(0, 90)).toEqual([0.00000000000000006123233995736766, 0, 1]);
    expect(lonLatToXYZ(-90, 0)).toEqual([0.00000000000000006123233995736766, -1, 0]);
    expect(lonLatToXYZ(0, -90)).toEqual([0.00000000000000006123233995736766, 0, -1]);
    expect(lonLatToXYZ(0, 0)).toEqual([1, 0, 0]);
  });
});

describe('lonLatToXYZGL', () => {
  it('should convert a lon-lat to XYZ', () => {
    expect(lonLatToXYZGL(0, 0)).toEqual([0, 0, 1]);
    expect(lonLatToXYZGL(90, 0)).toEqual([1, 0, 0.00000000000000006123233995736766]);
    expect(lonLatToXYZGL(0, 90)).toEqual([0, 1, 0.00000000000000006123233995736766]);
    expect(lonLatToXYZGL(-90, 0)).toEqual([-1, 0, 0.00000000000000006123233995736766]);
    expect(lonLatToXYZGL(0, -90)).toEqual([0, -1, 0.00000000000000006123233995736766]);
    expect(lonLatToXYZGL(0, 0)).toEqual([0, 0, 1]);
  });
});

describe('neighborsIJ', () => {
  it('should take a Face-I-J and find its neighbors', () => {
    expect(neighborsIJ(0, 0, 0)).toEqual([
      [5, 0, 1073741823],
      [0, 1, 0],
      [0, 0, 1],
      [4, 1073741823, 1073741823],
    ]);
  });

  it('should take a Face-I-J and find its neighbors given a level', () => {
    expect(neighborsIJ(0, 1, 1, 3)).toEqual([
      [0, 1, 0],
      [0, 2, 1],
      [0, 1, 2],
      [0, 0, 1],
    ]);
  });
});

describe('quadraticSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a quadratic fashion', () => {
    expect(quadraticSTtoUV(0)).toBe(-1);
    expect(quadraticSTtoUV(0.5)).toBe(0);
    expect(quadraticSTtoUV(1)).toBe(1);
  });
});

describe('quadraticUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a quadratic fashion', () => {
    expect(quadraticUVtoST(-1)).toBe(0);
    expect(quadraticUVtoST(0)).toBe(0.5);
    expect(quadraticUVtoST(1)).toBe(1);
  });
});

describe('tanSTtoUV', () => {
  it('should convert a [0, 1] to a [-1, 1] in a tangential fashion', () => {
    expect(tanSTtoUV(0)).toBe(-0.9999999999999999);
    expect(tanSTtoUV(0.5)).toBe(0);
    expect(tanSTtoUV(1)).toBe(0.9999999999999999);
  });
});

describe('tanUVtoST', () => {
  it('should convert a [-1, 1] to a [0, 1] in a tangential fashion', () => {
    expect(tanUVtoST(-1)).toBe(0);
    expect(tanUVtoST(0)).toBe(0.5);
    expect(tanUVtoST(1)).toBe(1);
  });
});

describe('tileXYFromSTZoom', () => {
  it('should convert an ST to a tile coordinate', () => {
    expect(tileXYFromSTZoom(0, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileXYFromSTZoom(0.5, 0, 1)).toEqual({ x: 1, y: 0 });
    expect(tileXYFromSTZoom(0.5, 0.5, 2)).toEqual({ x: 2, y: 2 });
  });
});

describe('tileXYFromUVZoom', () => {
  it('should convert a UV to a tile coordinate', () => {
    expect(tileXYFromUVZoom(-1, -1, 0)).toEqual({ x: 0, y: 0 });
    expect(tileXYFromUVZoom(0, -1, 1)).toEqual({ x: 1, y: 0 });
    expect(tileXYFromUVZoom(0, 0, 2)).toEqual({ x: 2, y: 2 });
  });
});

describe('xyzToLonLat', () => {
  it('should convert a XYZ to lon-lat', () => {
    expect(xyzToLonLat([1, 0, 0])).toEqual([0, 0]);
    expect(xyzToLonLat([0, 1, 0])).toEqual([90, 0]);
    expect(xyzToLonLat([0, 0, 1])).toEqual([0, 90]);
    expect(xyzToLonLat([-1, 0, 0])).toEqual([180, 0]);
    expect(xyzToLonLat([0, -1, 0])).toEqual([-90, 0]);
    expect(xyzToLonLat([0, 0, -1])).toEqual([0, -90]);
  });
});

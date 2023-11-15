import { toHash, toMurmur53 } from './hash';
import uniq from 'lodash/uniq';

const add = (a: number, b: number) => ((a|0) + (b|0)) >>> 0;
const rot = (a: number, b: number) => ((a << b) | (a >>> (32 - b))) >>> 0;
const mul = Math.imul;

describe('hash', () => {

  it("arithmetic", () => {
    expect(add(1, 1)).toEqual(2);
    expect(add(0x7fffffff, 1)).toEqual(0x80000000);
    expect(add(0xffffffff, 1)).toEqual(0);

    expect(mul(0x1000, 0x1000)).toEqual(0x1000000);
    expect(mul(0x7fffffff, 0x2)).toEqual(-2);
    expect(mul(0x80000001, 0x2)).toEqual(0x2);
    expect(mul(0x80000001, 0x80000001)).toEqual(0x1);

    expect(rot(0x7fffff00, 31)).toEqual(0x3fffff80);
    expect(rot(0x80000001, 31)).toEqual(0xc0000000);
  })

  it('hashes values', () => {

    const u81 = new Uint8Array(3);
    u81[0] = 1;
    u81[1] = 0;

    const u82 = new Uint8Array(3);
    u82[0] = 1;
    u82[1] = 2;

    const values = [
      undefined,
      null,
      "",
      "0",
      0,
      1,
      0x100000000,
      0x100000001,
      [],
      [0],
      [1],
      [1, 0],
      [1, 2],
      u81,
      u82,
      {},
      {f:0},
      {g:0},
      {f:1},
      {g:1},
    ];
    
    const hashes = values.map(toHash);
    
    expect(hashes).toMatchSnapshot();
    expect(uniq(hashes).length).toBe(hashes.length);
  });
  
  it("doesn't collide 16-bit ints", () => {

    const seen = new Map<number, number>();
    for (let i = 0; i < 0xffff; ++i) {
      const v = toMurmur53(i);
      if (seen.has(v)) {
        console.log('hash collision', seen.get(v), i, '=', v);
        expect(false).toBe(true);
      }
      seen.set(v, i);
    }

  });
});

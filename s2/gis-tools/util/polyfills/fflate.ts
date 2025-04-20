// Ported from https://github.com/101arrowz/fflate

// DEFLATE is a complex format; to read this code, you should probably check the RFC first:
// https://tools.ietf.org/html/rfc1951
// You may also wish to take a look at the guide I made about this program:
// https://gist.github.com/101arrowz/253f31eb5abc3d9275ab943003ffecad

// Some of the following code is similar to that of UZIP.js:
// https://github.com/photopea/UZIP.js
// However, the vast majority of the codebase has diverged from UZIP.js to increase performance
// and reduce bundle size.

// Sometimes 0 will appear where -1 would be more appropriate. This is because using a uint
// is better for memory in most engines (I *think*).

// fixed length extra bits
const fleb = new Uint8Array([
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  /* unused */ 0, 0, /* impossible */ 0,
]);

// fixed distance extra bits
const fdeb = new Uint8Array([
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
  /* unused */ 0, 0,
]);

// code length index map
const clim = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);

const { b: fl } = freb(fleb, 2);
// we can ignore the fact that the other numbers are wrong; they never happen anyway
fl[28] = 258;
const { b: fd } = freb(fdeb, 0);

// map of value to reverse (assuming 16 bits)
const rev = new Uint16Array(32768);
for (let i = 0; i < 32768; ++i) {
  // reverse table algorithm from SO
  let x = ((i & 0xaaaa) >> 1) | ((i & 0x5555) << 1);
  x = ((x & 0xcccc) >> 2) | ((x & 0x3333) << 2);
  x = ((x & 0xf0f0) >> 4) | ((x & 0x0f0f) << 4);
  rev[i] = (((x & 0xff00) >> 8) | ((x & 0x00ff) << 8)) >> 1;
}

// fixed length tree
const flt = new Uint8Array(288);
for (let i = 0; i < 144; ++i) flt[i] = 8;
for (let i = 144; i < 256; ++i) flt[i] = 9;
for (let i = 256; i < 280; ++i) flt[i] = 7;
for (let i = 280; i < 288; ++i) flt[i] = 8;
// fixed distance tree
const fdt = new Uint8Array(32);
for (let i = 0; i < 32; ++i) fdt[i] = 5;
// fixed length map
const flrm = hMap(flt, 9, 1);
// fixed distance map
const fdrm = hMap(fdt, 5, 1);

/**
 * Expands compressed GZIP, Zlib, or raw DEFLATE data, automatically detecting the format
 * @param data The data to decompress
 * @param dict - The dictionary used to compress the original data. If no dictionary was used during
 * compression, this option has no effect. Supplying the wrong dictionary during decompression
 * usually yields corrupt output or causes an invalid distance error.
 * @returns The decompressed version of the data
 */
export function decompressSync(data: Uint8Array, dict?: Uint8Array): Uint8Array {
  return data[0] === 31 && data[1] === 139 && data[2] === 8
    ? gunzipSync(data, dict)
    : (data[0] & 15) !== 8 || data[0] >> 4 > 7 || ((data[0] << 8) | data[1]) % 31 !== 0
      ? inflateSync(data, dict)
      : unzlibSync(data, dict);
}

/**
 * Expands GZIP data
 * @param data The data to decompress
 * @param dict - The dictionary used to compress the original data. If no dictionary was used during
 * compression, this option has no effect. Supplying the wrong dictionary during decompression
 * usually yields corrupt output or causes an invalid distance error.
 * @returns The decompressed version of the data
 */
export function gunzipSync(data: Uint8Array, dict?: Uint8Array): Uint8Array {
  const st = gzs(data);
  if (st + 8 > data.length) err(6, 'invalid gzip data');
  return inflt(data.subarray(st, -8), new Uint8Array(gzl(data)), dict);
}

/**
 * Expands DEFLATE data with no wrapper
 * @param data The data to decompress
 * @param dict - The dictionary used to compress the original data. If no dictionary was used during
 * compression, this option has no effect. Supplying the wrong dictionary during decompression
 * usually yields corrupt output or causes an invalid distance error.
 * @returns The decompressed version of the data
 */
export function inflateSync(data: Uint8Array, dict?: Uint8Array): Uint8Array {
  return inflt(data, undefined, dict);
}

/**
 * Expands Zlib data
 * @param data The data to decompress
 * @param dict - The dictionary used to compress the original data. If no dictionary was used during
 * compression, this option has no effect. Supplying the wrong dictionary during decompression
 * usually yields corrupt output or causes an invalid distance error.
 * @returns The decompressed version of the data
 */
export function unzlibSync(data: Uint8Array, dict?: Uint8Array): Uint8Array {
  return inflt(
    data.subarray(zls(data, dict), -4),

    undefined,
    dict,
  );
}

/**
 * expands raw DEFLATE data
 * @param dat - The data to decompress
 * @param bf - The output buffer
 * @param dict - The dictionary used to compress the original data. If no dictionary was used during
 * compression, this option has no effect.
 * @returns - The decompressed version of the data
 */
function inflt(dat: Uint8Array, bf?: Uint8Array, dict?: Uint8Array): Uint8Array {
  // source lengt - dict length
  const sl = dat.length,
    dl = dict?.length ?? 0;
  if (sl === 0) return bf ?? new Uint8Array(0);
  const noBuf = bf === undefined;
  // have to estimate size
  const resize = noBuf;
  // Assumes roughly 33% compression ratio average
  let buf: Uint8Array = bf ?? new Uint8Array(sl * 3);
  /**
   * ensure buffer can fit at least l elements
   * @param l - The number of elements
   */
  const cbuf = (l: number): void => {
    const bl = buf.length;
    // need to increase size to fit
    if (l > bl) {
      // Double or set to necessary, whichever is greater
      const nbuf = new Uint8Array(Math.max(bl * 2, l));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  //  last chunk - bitpos - bytes
  let final = 0,
    pos = 0,
    bt = 0,
    lm = undefined,
    dm = undefined,
    lbt = 0,
    dbt = 0;
  // total bits
  const tbts = sl * 8;
  do {
    if (lm === undefined) {
      // BFINAL - this is only 1 when last chunk is next
      final = bits(dat, pos, 1);
      // type: 0 = no compression, 1 = fixed huffman, 2 = dynamic huffman
      const type = bits(dat, pos + 1, 3);
      pos += 3;
      if (type === 0) {
        // go to end of byte boundary
        const s = shft(pos) + 4;
        const l = dat[s - 4] | (dat[s - 3] << 8);
        const t = s + l;
        if (t > sl) err(0);
        // ensure size
        if (resize) cbuf(bt + l);
        // Copy over uncompressed data
        buf.set(dat.subarray(s, t), bt);
        // Get new bitpos, update byte count
        bt += l;
        pos = t * 8;
        continue;
      } else if (type === 1) {
        lm = flrm;
        dm = fdrm;
        lbt = 9;
        dbt = 5;
      } else if (type === 2) {
        // literal & lengths
        const hLit = bits(dat, pos, 31) + 257;
        const hcLen = bits(dat, pos + 10, 15) + 4;
        const tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        // length+distance tree
        const ldt = new Uint8Array(tl);
        // code length tree
        const clt = new Uint8Array(19);
        for (let i = 0; i < hcLen; ++i) {
          // use index map to get real code
          clt[clim[i]] = bits(dat, pos + i * 3, 7);
        }
        pos += hcLen * 3;
        // code lengths bits
        const clb = max(clt),
          clbmsk = (1 << clb) - 1;
        // code lengths map
        const clm = hMap(clt, clb, 1);
        for (let i = 0; i < tl; ) {
          const r = clm[bits(dat, pos, clbmsk)];
          // bits read
          pos += r & 15;
          // symbol
          const s = r >> 4;
          // code length to copy
          if (s < 16) {
            ldt[i++] = s;
          } else {
            // copy & count
            let c = 0,
              n = 0;
            if (s === 16) {
              n = 3 + bits(dat, pos, 3);
              pos += 2;
              c = ldt[i - 1];
            } else if (s === 17) {
              n = 3 + bits(dat, pos, 7);
              pos += 3;
            } else if (s === 18) {
              n = 11 + bits(dat, pos, 127);
              pos += 7;
            }
            while (n-- !== 0) ldt[i++] = c;
          }
        }
        // length tree & distance tree
        const lt = ldt.subarray(0, hLit);
        const dt = ldt.subarray(hLit);
        // max length bits
        lbt = max(lt);
        // max dist bits
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else err(1);
      if (pos > tbts) err(0);
    }
    // Make sure the buffer can hold this + the largest possible addition
    // Maximum chunk size (practically, theoretically infinite) is 2^17
    if (resize) cbuf(bt + 131072);
    const lms = (1 << lbt) - 1,
      dms = (1 << dbt) - 1;
    for (;;) {
      // bits read, code
      const c = lm![bits16(dat, pos) & lms],
        sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        err(0);
      }
      if (c === 0) err(2);
      if (sym < 256) buf[bt++] = sym;
      else if (sym === 256) {
        lm = undefined;
        break;
      } else {
        let add = sym - 254;
        // no extra bits needed if less
        if (sym > 264) {
          // index
          const i = sym - 257,
            b = fleb[i];
          add = bits(dat, pos, (1 << b) - 1) + fl[i];
          pos += b;
        }
        // dist
        const d = dm![bits16(dat, pos) & dms],
          dsym = d >> 4;
        if (d === 0) err(3);
        pos += d & 15;
        let dt = fd[dsym];
        if (dsym > 3) {
          const b = fdeb[dsym];
          dt += bits16(dat, pos) & ((1 << b) - 1);
          pos += b;
        }
        if (pos > tbts) err(0);
        if (resize) cbuf(bt + 131072);
        const end = bt + add;
        if (bt < dt) {
          const shift = dl - dt,
            dend = Math.min(dt, end);
          if (shift + bt < 0) err(3);
          for (; bt < dend; ++bt) {
            buf[bt] = dict![shift + bt];
          }
        }
        for (; bt < end; ++bt) {
          if (bt >= dt) buf[bt] = buf[bt - dt];
        }
      }
    }
    if (lm !== undefined) final = 1;
  } while (final === 0);
  // don't reallocate for streams or user buffers
  return bt !== buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
}

/** freb result */
interface FrebRes {
  b: Uint16Array;
  r: Int32Array;
}

/**
 * get base, reverse index map from extra bits
 * @param eb - extra bits
 * @param start - start
 * @returns - {b, r}
 */
function freb(eb: Uint8Array, start: number): FrebRes {
  const b = new Uint16Array(31);
  for (let i = 0; i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  // numbers here are at max 18 bits
  const r = new Int32Array(b[30]);
  for (let i = 1; i < 30; ++i) {
    for (let j = b[i]; j < b[i + 1]; ++j) {
      r[j] = ((j - b[i]) << 5) | i;
    }
  }
  return { b, r };
}

/**
 * create huffman tree from u8 "map": index -> code length for code index
 * mb (max bits) must be at most 15
 * @param cd - input u8 "map": index -> code
 * @param mb - max bits
 * @param r - 0 for encoder, 1 for decoder
 * @returns - u16 "map": index -> code
 */
function hMap(cd: Uint8Array, mb: number, r: 0 | 1): Uint16Array {
  const s = cd.length;
  // index
  let i = 0;
  // u16 "map": index -> # of codes with bit length = index
  const l = new Uint16Array(mb);
  // length of cd must be 288 (total # of codes)
  for (; i < s; ++i) {
    if (cd[i] !== 0) ++l[cd[i] - 1];
  }
  // u16 "map": index -> minimum code for bit length = index
  const le = new Uint16Array(mb);
  for (i = 1; i < mb; ++i) {
    le[i] = (le[i - 1] + l[i - 1]) << 1;
  }
  let co: Uint16Array;
  if (r !== 0) {
    // u16 "map": index -> number of actual bits, symbol for code
    co = new Uint16Array(1 << mb);
    // bits to remove for reverser
    const rvb = 15 - mb;
    for (i = 0; i < s; ++i) {
      // ignore 0 lengths
      if (cd[i] !== 0) {
        // num encoding both symbol and bits read
        const sv = (i << 4) | cd[i];
        // free bits
        const r = mb - cd[i];
        // start value
        let v = le[cd[i] - 1]++ << r;
        // m is end value
        const m = v | ((1 << r) - 1);
        for (; v <= m; ++v) {
          // every 16 bit value starting with the code yields the same result
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    // ENCODER:
    co = new Uint16Array(s);
    //   for (i = 0; i < s; ++i) {
    //     if (cd[i] !== 0) {
    //       co[i] = rev[le[cd[i] - 1]++] >> (15 - cd[i]);
    //     }
    //   }
  }

  return co;
}

/**
 * find max of array
 * @param a - input array
 * @returns - max
 */
function max(a: Uint8Array | number[]): number {
  let m = a[0];
  for (let i = 1; i < a.length; ++i) {
    if (a[i] > m) m = a[i];
  }
  return m;
}

/**
 * read d, starting at bit p and mask with m
 * @param d - input
 * @param p - bit position
 * @param m - mask
 * @returns - bit value
 */
function bits(d: Uint8Array, p: number, m: number): number {
  const o = (p / 8) | 0;
  return ((d[o] | (d[o + 1] << 8)) >> (p & 7)) & m;
}

/**
 * read d, starting at bit p continuing for at least 16 bits
 * @param d - input
 * @param p - bit position
 * @returns - bit value
 */
function bits16(d: Uint8Array, p: number): number {
  const o = (p / 8) | 0;
  return (d[o] | (d[o + 1] << 8) | (d[o + 2] << 16)) >> (p & 7);
}

/**
 * get end of byte
 * @param p - bit position
 * @returns - end of byte
 */
function shft(p: number): number {
  return ((p + 7) / 8) | 0;
}

/**
 * typed array slice - allows garbage collector to free original reference,
 * while being more compatible than .slice
 * @param v - typed array
 * @param s - start
 * @param e - end (full length if undefined)
 * @returns - new typed array
 */
function slc(v: Uint8Array, s: number, e?: number): Uint8Array {
  if (s === undefined || s < 0) s = 0;
  if (e === undefined || e > v.length) e = v.length;
  // can't use .constructor in case user-supplied
  return new Uint8Array(v.subarray(s, e));
}

// error codes
const ec = [
  'unexpected EOF',
  'invalid block type',
  'invalid length/literal',
  'invalid distance',
  'stream finished',
  'no stream handler', // determined by compression function
  'no callback',
  // OTHER ERRORS LISTED GO BEYOND WHAT WE USE IN THIS LIBRARY
  // 'invalid UTF-8 data',
  // 'extra field too long',
  // 'date not in range 1980-2099',
  // 'filename too long',
  // 'stream finishing',
  // 'invalid zip data',
  // determined by unknown compression method
];

/** An error generated within this library */
export interface FlateError extends Error {
  /** The code associated with this error */
  code: number;
}

/**
 * An error generated within this library
 * @param ind - error code
 * @param msg - error message
 */
function err(ind: number, msg?: string): never {
  const e: Partial<FlateError> = new Error(msg ?? ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace !== undefined) Error.captureStackTrace(e, err);
  throw e;
}

/**
 * gzip start
 * @param d - gzip data
 * @returns - start
 */
function gzs(d: Uint8Array): number {
  if (d[0] !== 31 || d[1] !== 139 || d[2] !== 8) err(6, 'invalid gzip data');
  const flg = d[3];
  let st = 10;
  if ((flg & 4) !== 0) st += (d[10] | (d[11] << 8)) + 2;
  for (let zs = ((flg >> 3) & 1) + ((flg >> 4) & 1); zs > 0; zs -= Number(d[st++] === 0));
  return st + (flg & 2);
}

/**
 * gzip length
 * @param d - gzip data
 * @returns - length
 */
function gzl(d: Uint8Array): number {
  const l = d.length;
  return (d[l - 4] | (d[l - 3] << 8) | (d[l - 2] << 16) | (d[l - 1] << 24)) >>> 0;
}

/**
 * zlib start
 * @param d - zlib data
 * @param dict - dictionary
 * @returns - number
 */
function zls(d: Uint8Array, dict?: Uint8Array): number {
  if ((d[0] & 15) !== 8 || d[0] >> 4 > 7 || ((d[0] << 8) | d[1]) % 31 !== 0)
    err(6, 'invalid zlib data');
  if (Boolean((d[1] >> 5) & 1) === (dict === undefined))
    err(6, 'invalid zlib data: ' + ((d[1] & 32) !== 0 ? 'need' : 'unexpected') + ' dictionary');
  return ((d[1] >> 3) & 4) + 2;
}

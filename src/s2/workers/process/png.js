import zlib from 'zlib'

const inflate = function (data, callback) {
  return zlib.inflate(Buffer.from(data), callback)
}

const slice = Array.prototype.slice
const toString = Object.prototype.toString

class PNG {
  width = 0
  height = 0
  bitDepth = 0
  colorType = 0
  compressionMethod = 0
  filterMethod = 0
  interlaceMethod = 0
  colors = 0
  alpha = false
  pixelBits = 0
  palette = null
  pixels = null
  trns = null

	setWidth (width) {
	  this.width = width
	}

	setHeight (height) {
	  this.height = height
	}

	setBitDepth (bitDepth) {
	  if ([2, 4, 8, 16].indexOf(bitDepth) === -1) {
	    throw new Error('invalid bith depth ' + bitDepth)
	  }
	  this.bitDepth = bitDepth
	}

	setColorType (colorType) {
	  //   Color    Allowed    Interpretation
	  //   Type    Bit Depths
	  //
	  //   0       1,2,4,8,16  Each pixel is a grayscale sample.
	  //
	  //   2       8,16        Each pixel is an R,G,B triple.
	  //
	  //   3       1,2,4,8     Each pixel is a palette index;
	  //                       a PLTE chunk must appear.
	  //
	  //   4       8,16        Each pixel is a grayscale sample,
	  //                       followed by an alpha sample.
	  //
	  //   6       8,16        Each pixel is an R,G,B triple,
	  //                       followed by an alpha sample.

	  let colors = 0; let alpha = false

	  switch (colorType) {
	    case 0: colors = 1; break
	    case 2: colors = 3; break
	    case 3: colors = 1; break
	    case 4: colors = 2; alpha = true; break
	    case 6: colors = 4; alpha = true; break
	    default: throw new Error('invalid color type')
	  }

	  this.colors = colors
	  this.alpha = alpha
	  this.colorType = colorType
	}

	setCompressionMethod (compressionMethod) {
	  if (compressionMethod !== 0) {
	    throw new Error('invalid compression method ' + compressionMethod)
	  }
	  this.compressionMethod = compressionMethod
	}

	setFilterMethod (filterMethod) {
	  if (filterMethod !== 0) {
	    throw new Error('invalid filter method ' + filterMethod)
	  }
	  this.filterMethod = filterMethod
	}

	setInterlaceMethod (interlaceMethod) {
	  if (interlaceMethod !== 0 && interlaceMethod !== 1) {
	    throw new Error('invalid interlace method ' + interlaceMethod)
	  }
	  this.interlaceMethod = interlaceMethod
	}

	setTRNS (trns) {
	  this.trns = trns
	}

	setPalette (palette) {
	  if (palette.length % 3 !== 0) {
	    throw new Error('incorrect PLTE chunk length')
	  }
	  if (palette.length > (Math.pow(2, this.bitDepth) * 3)) {
	    throw new Error('palette has more colors than 2^bitdepth')
	  }
	  this.palette = palette
	}

	/**
	 * get the pixel color on a certain location in a normalized way
	 * result is an array: [red, green, blue, alpha]
	 */
	getPixel (x, y) {
		if (!this.pixels) throw new Error('pixel data is empty')
		if (x >= this.width || y >= this.height) {
			throw new Error('x,y position out of bound')
		}
		let i = this.colors * this.bitDepth / 8 * (y * this.width + x)
		let pixels = this.pixels

		switch (this.colorType) {
			case 0: return [pixels[i], pixels[i], pixels[i], 255]
			case 2: return [pixels[i], pixels[i + 1], pixels[i + 2], 255]
			case 3:
				let alpha = 255
				if (this.trns != null && this.trns[pixels[i]] != null) {
					alpha = this.trns[pixels[i]]
				}
				return [
					this.palette[pixels[i] * 3 + 0],
					this.palette[pixels[i] * 3 + 1],
					this.palette[pixels[i] * 3 + 2],
					alpha
				]
			case 4: return [pixels[i], pixels[i], pixels[i], pixels[i + 1]]
			case 6: return [pixels[i], pixels[i + 1], pixels[i + 2], pixels[i + 3]]
		}
	}

	/**
	 * get the pixels of the image as a RGBA array of the form [r1, g1, b1, a1, r2, b2, g2, a2, ...]
	 * Matches the api of canvas.getImageData
	 */
	getRGBA8Array () {
	  let data = new Array(this.width * this.height * 4)
	  for (let y = 0; y < this.height; y++) {
	  // for (let y = this.height - 1; y >= 0; y--) {
	    for (let x = 0; x < this.width; x++) {
	      let pixelData = this.getPixel(x, y)

	      data[(y * this.width + x) * 4 + 0] = pixelData[0]
	      data[(y * this.width + x) * 4 + 1] = pixelData[1]
	      data[(y * this.width + x) * 4 + 2] = pixelData[2]
	      data[(y * this.width + x) * 4 + 3] = pixelData[3]
	    }
	  }
	  return data
	}
}

export default class PNGReader {
	i = 0
	bytes
	png = new PNG()
	dataChunks = []
	constructor (bytes) {
		if (typeof bytes === 'string') {
	    let bts = bytes
	    bytes = new Array(bts.length)
	    for (let i = 0, l = bts.length; i < l; i++) {
	      bytes[i] = bts[i].charCodeAt(0)
	    }
	  } else {
	    let type = toString.call(bytes).slice(8, -1)
	    if (type === 'ArrayBuffer') bytes = new Uint8Array(bytes)
	  }
		this.bytes = bytes
	}

	readBytes (length) {
	  let end = this.i + length
	  if (end > this.bytes.length) {
	    throw new Error('Unexpectedly reached end of file')
	  }
	  let bytes = slice.call(this.bytes, this.i, end)
	  this.i = end
	  return bytes
	}

	/**
	 * http://www.w3.org/TR/2003/REC-PNG-20031110/#5PNG-file-signature
	 */
	decodeHeader () {
	  if (this.i !== 0) {
	    throw new Error('file pointer should be at 0 to read the header')
	  }

	  let header = this.readBytes(8)

	  if (!equalBytes(header, [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])) {
	    throw new Error('invalid PNGReader file (bad signature)')
	  }

	  this.header = header
	}

	/**
	 * http://www.w3.org/TR/2003/REC-PNG-20031110/#5Chunk-layout
	 *
	 * length =  4      bytes
	 * type   =  4      bytes (IHDR, PLTE, IDAT, IEND or others)
	 * chunk  =  length bytes
	 * crc    =  4      bytes
	 */
	decodeChunk () {
	  let length = readUInt32(this.readBytes(4), 0)

	  if (length < 0) {
	    throw new Error('Bad chunk length ' + (0xFFFFFFFF & length))
	  }

	  let type = bufferToString(this.readBytes(4))
	  let chunk = this.readBytes(length)
	  this.readBytes(4) // crc

	  switch (type) {
	    case 'IHDR': this.decodeIHDR(chunk); break
	    case 'PLTE': this.decodePLTE(chunk); break
	    case 'IDAT': this.decodeIDAT(chunk); break
	    case 'tRNS': this.decodeTRNS(chunk); break
	  }

	  return type
	}

	/**
	 * http://www.w3.org/TR/2003/REC-PNG-20031110/#11IHDR
	 * http://www.libpng.org/pub/png/spec/1.2/png-1.2-pdg.html#C.IHDR
	 *
	 * Width               4 bytes
	 * Height              4 bytes
	 * Bit depth           1 byte
	 * Colour type         1 byte
	 * Compression method  1 byte
	 * Filter method       1 byte
	 * Interlace method    1 byte
	 */
	decodeIHDR (chunk) {
	  let png = this.png

	  png.setWidth(readUInt32(chunk, 0))
	  png.setHeight(readUInt32(chunk, 4))
	  png.setBitDepth(readUInt8(chunk, 8))
	  png.setColorType(readUInt8(chunk, 9))
	  png.setCompressionMethod(readUInt8(chunk, 10))
	  png.setFilterMethod(readUInt8(chunk, 11))
	  png.setInterlaceMethod(readUInt8(chunk, 12))
	}

	/**
	 *
	 * http://www.w3.org/TR/PNG/#11PLTE
	 */
	decodePLTE (chunk) {
	  this.png.setPalette(chunk)
	}

	/**
	 * http://www.w3.org/TR/2003/REC-PNG-20031110/#11IDAT
	 */
	decodeIDAT (chunk) {
	  // multiple IDAT chunks will concatenated
	  this.dataChunks.push(chunk)
	}

	/**
	 * https://www.w3.org/TR/PNG/#11tRNS
	 */
	decodeTRNS (chunk) {
	  this.png.setTRNS(chunk)
	}

	/**
	 * Uncompress IDAT chunks
	 */
	decodePixels (callback) {
		const self = this
	  const { png } = self
	  let length = 0
	  let i, j, k, l
	  for (l = this.dataChunks.length; l--;) length += this.dataChunks[l].length
	  let data = Buffer.alloc(length)
	  for (i = 0, k = 0, l = this.dataChunks.length; i < l; i++) {
	    let chunk = this.dataChunks[i]
	    for (j = 0; j < chunk.length; j++) data[k++] = chunk[j]
	  }
	  inflate(data, (err, data) => {
	    if (err) return callback(err)

	    try {
	      if (png.interlaceMethod === 0) self.interlaceNone(data)
	    } catch (e) { return callback(e) }

	    callback()
	  })
	}

	// Different interlace methods

	interlaceNone (data) {
	  let png = this.png

	  // bytes per pixel
	  let bpp = Math.max(1, png.colors * png.bitDepth / 8)

	  // color bytes per row
	  let cpr = bpp * png.width

	  let pixels = Buffer.alloc(bpp * png.width * png.height)
	  let scanline
	  let offset = 0

	  for (let i = 0; i < data.length; i += cpr + 1) {
	    scanline = slice.call(data, i + 1, i + cpr + 1)

	    switch (readUInt8(data, i)) {
	      case 0: this.unFilterNone(scanline, pixels, bpp, offset, cpr); break
	      case 1: this.unFilterSub(scanline, pixels, bpp, offset, cpr); break
	      case 2: this.unFilterUp(scanline, pixels, bpp, offset, cpr); break
	      case 3: this.unFilterAverage(scanline, pixels, bpp, offset, cpr); break
	      case 4: this.unFilterPaeth(scanline, pixels, bpp, offset, cpr); break
	      default: throw new Error('unkown filtered scanline')
	    }

	    offset += cpr
	  }

	  png.pixels = pixels
	}

	// Unfiltering

	/**
	 * No filtering, direct copy
	 */
	unFilterNone (scanline, pixels, bpp, of, length) {
	  for (let i = 0, to = length; i < to; i++) {
	    pixels[of + i] = scanline[i]
	  }
	}

	/**
	 * The Sub() filter transmits the difference between each byte and the value
	 * of the corresponding byte of the prior pixel.
	 * Sub(x) = Raw(x) + Raw(x - bpp)
	 */
	unFilterSub (scanline, pixels, bpp, of, length) {
	  let i = 0
	  for (; i < bpp; i++) pixels[of + i] = scanline[i]
	  for (; i < length; i++) {
	    // Raw(x) + Raw(x - bpp)
	    pixels[of + i] = (scanline[i] + pixels[of + i - bpp]) & 0xFF
	  }
	}

	/**
	 * The Up() filter is just like the Sub() filter except that the pixel
	 * immediately above the current pixel, rather than just to its left, is used
	 * as the predictor.
	 * Up(x) = Raw(x) + Prior(x)
	 */
	unFilterUp (scanline, pixels, bpp, of, length) {
	  let i = 0; let byte; let prev
	  // Prior(x) is 0 for all x on the first scanline
	  if ((of - length) < 0) {
	    for (; i < length; i++) {
	      pixels[of + i] = scanline[i]
	    }
	  } else {
	    for (; i < length; i++) {
	    // Raw(x)
	      byte = scanline[i]
	      // Prior(x)
	      prev = pixels[of + i - length]
	      pixels[of + i] = (byte + prev) & 0xFF
	    }
	  }
	}

	/**
	 * The Average() filter uses the average of the two neighboring pixels (left
	 * and above) to predict the value of a pixel.
	 * Average(x) = Raw(x) + floor((Raw(x-bpp)+Prior(x))/2)
	 */
	unFilterAverage (scanline, pixels, bpp, of, length) {
	  let i = 0; let byte; let prev; let prior
	  if ((of - length) < 0) {
	    // Prior(x) == 0 && Raw(x - bpp) == 0
	    for (; i < bpp; i++) {
	      pixels[of + i] = scanline[i]
	    }
	    // Prior(x) == 0 && Raw(x - bpp) != 0 (right shift, prevent doubles)
	    for (; i < length; i++) {
	      pixels[of + i] = (scanline[i] + (pixels[of + i - bpp] >> 1)) & 0xFF
	    }
	  } else {
	    // Prior(x) != 0 && Raw(x - bpp) == 0
	    for (; i < bpp; i++) {
	      pixels[of + i] = (scanline[i] + (pixels[of - length + i] >> 1)) & 0xFF
	    }
	    // Prior(x) != 0 && Raw(x - bpp) != 0
	    for (; i < length; i++) {
	      byte = scanline[i]
	      prev = pixels[of + i - bpp]
	      prior = pixels[of + i - length]
	      pixels[of + i] = (byte + (prev + prior >> 1)) & 0xFF
	    }
	  }
	}

	/**
	 * The Paeth() filter computes a simple linear function of the three
	 * neighboring pixels (left, above, upper left), then chooses as predictor
	 * the neighboring pixel closest to the computed value. This technique is due
	 * to Alan W. Paeth.
	 * Paeth(x) = Raw(x) +
	 *            PaethPredictor(Raw(x-bpp), Prior(x), Prior(x-bpp))
	 *  function PaethPredictor (a, b, c)
	 *  begin
	 *       ; a = left, b = above, c = upper left
	 *       p := a + b - c        ; initial estimate
	 *       pa := abs(p - a)      ; distances to a, b, c
	 *       pb := abs(p - b)
	 *       pc := abs(p - c)
	 *       ; return nearest of a,b,c,
	 *       ; breaking ties in order a,b,c.
	 *       if pa <= pb AND pa <= pc then return a
	 *       else if pb <= pc then return b
	 *       else return c
	 *  end
	 */
	unFilterPaeth (scanline, pixels, bpp, of, length) {
	  let i = 0; let raw; let a; let b; let c; let p; let pa; let pb; let pc; let pr
	  if ((of - length) < 0) {
	    // Prior(x) == 0 && Raw(x - bpp) == 0
	    for (; i < bpp; i++) {
	      pixels[of + i] = scanline[i]
	    }
	    // Prior(x) == 0 && Raw(x - bpp) != 0
	    // paethPredictor(x, 0, 0) is always x
	    for (; i < length; i++) {
	      pixels[of + i] = (scanline[i] + pixels[of + i - bpp]) & 0xFF
	    }
	  } else {
	    // Prior(x) != 0 && Raw(x - bpp) == 0
	    // paethPredictor(x, 0, 0) is always x
	    for (; i < bpp; i++) {
	      pixels[of + i] = (scanline[i] + pixels[of + i - length]) & 0xFF
	    }
	    // Prior(x) != 0 && Raw(x - bpp) != 0
	    for (; i < length; i++) {
	      raw = scanline[i]
	      a = pixels[of + i - bpp]
	      b = pixels[of + i - length]
	      c = pixels[of + i - length - bpp]
	      p = a + b - c
	      pa = Math.abs(p - a)
	      pb = Math.abs(p - b)
	      pc = Math.abs(p - c)
	      if (pa <= pb && pa <= pc) pr = a
	      else if (pb <= pc) pr = b
	      else pr = c
	      pixels[of + i] = (raw + pr) & 0xFF
	    }
	  }
	}

	/**
	 * Parse the PNG file
	 *
	 * reader.parse(options, callback)
	 * OR
	 * reader.parse(callback)
	 *
	 * OPTIONS:
	 *    option  | type     | default
	 *    ----------------------------
	 *    data      boolean    true    should it read the pixel data
	 */
	parse (options, callback) {
	  if (typeof options === 'function') callback = options
	  if (typeof options !== 'object') options = {}

	  try {
	    this.decodeHeader()

	    while (this.i < this.bytes.length) {
	      const type = this.decodeChunk()
	      // stop after IHDR chunk, or after IEND
	      if ((type === 'IHDR' && options.data === false) || type === 'IEND') break
	    }

	    this.decodePixels((err) => {
	      callback(err, this.png)
	    })
	  } catch (e) {
	    callback(e)
	  }
	}
}

function equalBytes (a, b) {
  if (a.length !== b.length) return false
  for (let l = a.length; l--;) if (a[l] !== b[l]) return false
  return true
}

function readUInt32 (buffer, offset) {
  return (buffer[offset] << 24) + (buffer[offset + 1] << 16) + (buffer[offset + 2] << 8) + (buffer[offset + 3] << 0)
}

function readUInt8 (buffer, offset) {
  return buffer[offset] << 0
}

function bufferToString (buffer) {
  let str = ''
  for (let i = 0; i < buffer.length; i++) {
    str += String.fromCharCode(buffer[i])
  }
  return str
}

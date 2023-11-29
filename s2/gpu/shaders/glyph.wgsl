const PI = 3.141592653589793238;

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) texcoord: vec2<f32>,
  @location(2) buf: f32,
  @location(3) gamma: f32,
};

struct TestOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
};

struct ViewUniforms {
  cBlind: f32, // colorblind support
  zoom: f32, // exact zoom
  lon: f32,
  lat: f32,
  bearing: f32,
  pitch: f32,
  time: f32,
  aspectX: f32,
  aspectY: f32,
  featureState: f32,
  curFeature: f32,
  devicePixelRatio: f32,
};

struct TileUniforms {
  isS2: f32, // Either S2 Projection or WM
  face: f32, // face relative to current tile
  zoom: f32, // zoom relative to current tile
  sLow: f32,
  tLow: f32,
  deltaS: f32,
  deltaT: f32,
};

struct TilePosition {
  bottomLeft: vec2<f32>,
  bottomRight: vec2<f32>,
  topLeft: vec2<f32>,
  topRight: vec2<f32>,
};

struct LayerUniforms {
  depthPos: f32,
  useLCH: f32, // use LCH coloring or RGB if false
};

struct GlyphUniforms {
  indexOffset: u32, // where to start searching the collisionResults array
  // TODO: drawType should be local to the glyph
  // drawType: f32, // 0 -> MTSDF, 1 -> SDF, 2 -> RAW_IMAGE
  isIcon: f32,
  overdraw: f32,
  deltaTime: f32, // time since last frame
  deltaDuration: f32, // duration of an animation cycle
};

struct Bounds {
  left: f32,
  bottom: f32,
  right: f32,
  top: f32,
};

// TODO: Store ID in the collision result array??? That way we can check the end of the ID
// TODO - IDEA: One more compute shader that runs through each GlyphContainer and checks the collisionResults
// TODO - IDEA: If the collisionResults is 0 or 1, then we update the last 8 bits +- a change value
// to see if it's a shared container (and how many containers it shares with for opacity change)
struct GlyphContainer {
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  xy: vec2<f32>, // xy starting position of the glyph box relative to the final computed position
  pad: vec2<f32>, // padding around the container
  wh: vec2<f32>, // width & height of the container
  index: u32, // index in the collision result array without offset (needed because some Containers share indexes)
  id: u32, // identifier - the last 8 bits explain how many containers it shares with
};

struct BBox {
  index: u32, 
  left: f32,
  bottom: f32,
  right: f32,
  top: f32,
};

// ** FRAME DATA **
// frame data is updated at the beginning of each new frame
@binding(0) @group(0) var<uniform> view: ViewUniforms;
@binding(1) @group(0) var<uniform> matrix: mat4x4<f32>;
// ** TILE DATA **
// these bindings are stored in the tile's mask data
// tile's need to self update positional data so we can store them a single time in a tile
@binding(0) @group(1) var<uniform> tile: TileUniforms;
@binding(1) @group(1) var<uniform> tilePos: TilePosition;
// ** LAYER DATA **
// layer data can be created upon style invocation. This data is static and will not change
// unless the style is edited.
@binding(2) @group(1) var<uniform> layer: LayerUniforms;
@binding(3) @group(1) var<storage, read> layerCode: array<f32>;
// ** FEATURE DATA **
// every feature will have it's own code to parse it's attribute data in real time
@binding(4) @group(1) var<storage, read> featureCode: array<f32>;
// ** GLYPH DATA **
@binding(0) @group(2) var<uniform> bounds: Bounds;
@binding(1) @group(2) var<uniform> glyph: GlyphUniforms;
@binding(2) @group(2) var glyphSampler: sampler;
@binding(3) @group(2) var glyphTexture: texture_2d<f32>;
// the bbox index is the container position + the glyph indexOffset
// the collision result index is the container's index value + the glyph indexOffset
@binding(4) @group(2) var<storage, read> containers: array<GlyphContainer>;
@binding(5) @group(2) var<storage, read_write> bboxes: array<BBox>;
@binding(6) @group(2) var<storage, read_write> collisionResults: array<atomic<u32>>;
@binding(8) @group(2) var<storage, read> collisionResultsReadOnly: array<u32>;
@binding(9) @group(2) var<uniform> isStroke: f32; // 1 for stroke, 0 for fill

fn LCH2LAB (lch: vec4<f32>) -> vec4<f32> { // r -> l ; g -> c ; b -> h
  var h = lch.b * (PI / 180.);
  return vec4<f32>(
    lch.r,
    cos(h) * lch.g, // change c to a
    sin(h) * lch.g, // change h to b
    lch.a
  );
}

fn LAB2XYZ (t: f32) -> f32 {
  if (t > 0.206896552) { return t * t * t; }
  else { return 0.12841855 * (t - 0.137931034); }
}

fn XYZ2RGB (r: f32) -> f32 {
  var _r = 0.0f;
  if (r <= 0.00304) {
    _r = 12.92 * r;
  } else {
    _r = 1.055 * pow(r, 1. / 2.4) - 0.055;
  }
  return 255. * _r;
}

fn LAB2RGB (lab: vec4<f32>) -> vec4<f32> { // r -> l ; g -> a ; b -> b
  // prep move to xyz
  var y = (lab.r + 16.) / 116.;
  var x = y + lab.g / 500.;
  var z = y - lab.b / 200.;
  // solve x, y, z
  x = 0.950470 * LAB2XYZ(x);
  y = 1. * LAB2XYZ(y);
  z = 1.088830 * LAB2XYZ(z);
  // xyz to rgb
  var r = XYZ2RGB(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  var g = XYZ2RGB(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z);
  var b = XYZ2RGB(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
  // clip space from 0 to 255
  if (r < 0.) { r = 0.; }
  else if (r > 255.) { r = 255.; }
  if (g < 0.) { g = 0.; }
  else if (g > 255.) { g = 255.; }
  if (b < 0.) { b = 0.; }
  else if (b > 255.) { b = 255.; }
  // return updated values
  return vec4<f32>(r, g, b, lab.a);
}

fn LCH2RGB (lch: vec4<f32>) -> vec4<f32> {
  // first convert to lab
  var res = LCH2LAB(lch);
  // convert from lab to rgb
  res = LAB2RGB(res);
  // lastly, divide each number by clip space size 255
  res.r /= 255.;
  res.g /= 255.;
  res.b /= 255.;
  return res;
}

// COLOR BLIND ADJUST:
// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js
fn cBlindAdjust (rgba: vec4<f32>) -> vec4<f32> {
  // setup rgb
  var r = rgba.r * 255.;
  var g = rgba.g * 255.;
  var b = rgba.b * 255.;
  // if uCBlind is 4 return grayscale
  if (view.cBlind == 4.) {
    var l = (0.3 * r) + (0.59 * g) + (0.11 * b);
    return vec4<f32>(
      l / 255.,
      l / 255.,
      l / 255.,
      rgba.a
    );
  }
  // grab color conversion mode
  var CVD = array<f32, 9>();
  if (view.cBlind == 1.) { CVD = array<f32, 9>(0.0, 2.02344, -2.52581, 0., 1., 0., 0., 0., 1.); } // protanopia
  else if (view.cBlind == 2.) { CVD = array<f32, 9>(1.0, 0., 0., 0.494207, 0., 1.24827, 0., 0., 1.); } // deutranopia
  else { CVD = array<f32, 9>(1.0, 0., 0., 0., 1.0, 0., -0.395913, 0.801109, 0.); } // tritanopia
  // RGB to LMS matrix conversion
	var L = (17.8824 * r) + (43.5161 * g) + (4.11935 * b);
	var M = (3.45565 * r) + (27.1554 * g) + (3.86714 * b);
	var S = (0.0299566 * r) + (0.184309 * g) + (1.46709 * b);
	// Simulate color blindness
	var l = (CVD[0] * L) + (CVD[1] * M) + (CVD[2] * S);
	var m = (CVD[3] * L) + (CVD[4] * M) + (CVD[5] * S);
	var s = (CVD[6] * L) + (CVD[7] * M) + (CVD[8] * S);
	// LMS to RGB matrix conversion
	var R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	var G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	var B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = r - R;
	G = g - G;
	B = b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	var GG = (0.7 * R) + (1.0 * G);
	var BB = (0.7 * R) + (1.0 * B);
	// Add compensation to original values, clamp to 0->255 range, rescope to 0->1 range.
  return vec4<f32>(
    clamp(r, 0., 255.) / 255.,
    clamp(GG + g, 0., 255.) / 255.,
    clamp(BB + b, 0., 255.) / 255.,
    rgba.a
  );
}

// y = e^x OR y = Math.pow(2, 10 * x)
fn exponentialInterpolation (inputVal: f32, start: f32, end: f32, base: f32) -> f32 {
  // grab change
  var diff = end - start;
  if (diff == 0.) { return 0.; }
  // refine base value
  var mutBase = base;
  if (mutBase <= 0.) { mutBase = 0.1; }
  else if (mutBase > 2.) { mutBase = 2.; }
  // grab diff
  var progress = inputVal - start;
  // linear case
  if (mutBase == 1.) { return progress / diff; }
  // solve
  return (pow(mutBase, progress) - 1.) / (pow(mutBase, diff) - 1.);
}

fn interpolateColor (color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
  // dummy check
  if (t == 0.) { return color1; }
  else if (t == 1.) { return color2; }
  var hue = 0.;
  // LCH interpolation
  if (layer.useLCH != 0.) { // create proper hue translation
    var dh = 0.;
    if (color2[0] > color1[0] && color2[0] - color1[0] > 180.) { dh = color2[0] - color1[0] + 360.; }
    else if (color2[0] < color1[0] && color1[0] - color2[0] > 180.) { dh = color2[0] + 360. - color1[0]; }
    else { dh = color2[0] - color1[0]; }
    hue = color1[0] + t * dh;
  } else { // otherwise red
    hue = color1[0] + t * (color2[0] - color1[0]);
  }
  // saturation or green
  var sat = color1[1] + t * (color2[1] - color1[1]);
  // luminosity or blue
  var lbv = color1[2] + t * (color2[2] - color1[2]);
  // alpha
  var alpha = color1[3] + t * (color2[3] - color1[3]);
  // create the new color
  return vec4<f32>(hue, sat, lbv, alpha);
}

fn stToUV (s: f32) -> f32 {
  var mutS = s;
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (mutS >= 0.5) { return (1. / 3.) * (4. * mutS * mutS - 1.); }
  else { return (1. / 3.) * (1. - 4. * (1. - mutS) * (1. - mutS)); }
}

fn stToXYZ (st: vec2<f32>) -> vec4<f32> { // x -> s, y -> t
  var mutST = st;
  mutST /= 8192.;
  let face = tile.face;
  // prep xyz
  var xyz = vec3<f32>();
  // convert to uv
  let uv = vec2<f32>(
    stToUV(tile.deltaS * mutST.x + tile.sLow), // deltaS * sPos + sLow
    stToUV(tile.deltaT * mutST.y + tile.tLow) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (face == 0.) { xyz = vec3(uv.x, uv.y, 1.); }
  else if (face == 1.) { xyz = vec3(1., uv.y, -uv.x); }
  else if (face == 2.) { xyz = vec3(-uv.y, 1., -uv.x); }
  else if (face == 3.) { xyz = vec3(-uv.y, -uv.x, -1.); }
  else if (face == 4.) { xyz = vec3(-1., -uv.x, uv.y); }
  else { xyz = vec3(uv.x, -1., uv.y); }
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

fn getPosLocal (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  mutPos /= 8192.;
  if (tile.isS2 == 0.) {
    return matrix * vec4(mutPos, 0, 1);
  }
  // find position following s
  var deltaBottom = tilePos.bottomRight - tilePos.bottomLeft;
  var deltaTop = tilePos.topRight - tilePos.topLeft;
  var bottomPosS = tilePos.bottomLeft + deltaBottom * mutPos.x;
  var topPosS = tilePos.topLeft + deltaTop * mutPos.x;
  // using s positions, find t
  var deltaS = topPosS - bottomPosS;
  var res = bottomPosS + deltaS * mutPos.y;
  return vec4(res, 0., 1.);
}

fn getPos (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  if (tile.isS2 == 0.) {
    mutPos /= 8192.;
    return matrix * vec4<f32>(mutPos, 0., 1.);
  } else if (view.zoom < 12.) {
    return matrix * stToXYZ(mutPos);
  } else {
    return getPosLocal(mutPos);
  }
}

fn getZero () -> vec4<f32> {
  if (view.zoom < 12.) {
    return matrix * vec4<f32>(0., 0., 0., 1.);
  } else { return vec4<f32>(0., 0., 1., 1.); }
}

fn decodeFeature (color: bool, indexPtr: ptr<function, u32>, featureIndexPtr: ptr<function, u32>) -> vec4<f32> {
  let uInputs = array<f32, 10>(view.zoom, view.lon, view.lat, view.bearing, view.pitch, view.time, view.aspectX, view.aspectY, view.featureState, view.curFeature);
  // prep result and variables
  var index = u32(*indexPtr);
  var featureIndex = u32(*featureIndexPtr);
  var decodeOffset = index;
  var startingOffset = index;
  var featureSize = u32(layerCode[index]) >> 10;
  var res = vec4<f32>(-1., -1., -1., -1.);
  var conditionStack = array<u32, 6>();
  var tStack = array<f32, 6>();
  var stackIndex = 1u; // start at 1 because our loop decrements this at start
  conditionStack[0] = index;
  var len = 0u;
  var conditionSet = 0u;
  var condition = 0u;

  loop {
    stackIndex--;
    // pull out current stackIndex condition an decode
    index = conditionStack[stackIndex];
    startingOffset = index;
    conditionSet = u32(layerCode[index]);
    len = conditionSet >> 10;
    condition = (conditionSet & 1008) >> 4;
    index++;
    // for each following condition, pull out the eventual color and set to val
    if (condition == 0) {
    } else if (condition == 1) { // value
      if (res[0] == -1.) {
        for (var i = 0u; i < len - 1; i++) {
          res[i] = f32(layerCode[index + i]);
        }
      } else {
        if (color) {
          var val = vec4<f32>(layerCode[index], layerCode[index + 1], layerCode[index + 2], layerCode[index + 3]);
          res = interpolateColor(res, val, tStack[stackIndex]);
        } else {
          for (var i = 0u; i < len - 1; i++) {
            res[i] = res[i] + tStack[stackIndex] * (layerCode[index + i] - res[i]);
          }
        }
      }
    } else if (condition == 2 || condition == 3) { // data-condition & input-condition
      // get the input from either featureCode or uInputs
      var inputVal = 0.;
      var conditionInput = 0.;
      if (condition == 2) {
        inputVal = featureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[(conditionSet & 14) >> 1]; }
      // now that we have the inputVal, we iterate through and find a match
      conditionInput = layerCode[index];
      loop {
        // if we found condition, move on; if we hit the default, than the value does not exist
        if (inputVal == conditionInput || conditionInput == 0.) { break; }
        // increment index & find length
        index += (u32(layerCode[index + 1]) >> 10) + 1;
        conditionInput = layerCode[index];
      }
      index++; // increment to conditionEncoding
      // now add subCondition to be parsed
      conditionStack[stackIndex] = index;
      tStack[stackIndex] = 1.;
      stackIndex++; // increment size of stackIndex
    } else if (condition == 4 || condition == 5) { // data-range & input-range
      // get interpolation & base
      var interpolationType = conditionSet & 1;
      var inputType = (conditionSet & 14) >> 1;
      var base = 1.;
      if (interpolationType == 1) {
        base = layerCode[index];
        index++;
      }
      // find the two values and run them
      var inputVal = 0.;
      var start = 0.;
      var end = 0.;
      var startIndex = 0u;
      var endIndex = 0u;
      var subCondition = 0u;
      // grab the inputVal value
      if (condition == 4) {
        inputVal = featureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[inputType]; }
      // create a start point
      end = layerCode[index];
      start = end;
      endIndex = index + 1;
      startIndex = endIndex;
      while (end < inputVal && endIndex < len + startingOffset) {
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the featureCode that was stored there
        subCondition = (u32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        // increment to subCondition
        index++;
        // increment by subConditions length
        index += u32(layerCode[index]) >> 10;
        // set new start and end
        start = end;
        startIndex = endIndex;
        endIndex = index + 1;
        if (endIndex < len + startingOffset) { end = layerCode[index]; }
      }
      // if start and end are the same, we only need to process the first piece
      if (startIndex == endIndex) {
        conditionStack[stackIndex] = startIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1]; }
        else { tStack[stackIndex] = 1.; } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else if (end == inputVal) {
        conditionStack[stackIndex] = endIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1]; }
        else { tStack[stackIndex] = 1.; } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else { // otherwise we process startIndex and endIndex
        var t = exponentialInterpolation(inputVal, start, end, base);
        conditionStack[stackIndex] = startIndex;
        tStack[stackIndex] = 1. - t;
        stackIndex++;
        conditionStack[stackIndex] = endIndex;
        tStack[stackIndex] = t;
        stackIndex++;
      }
      // now that we got the information we need - we need to ensure we flush all feature subCondition data
      // hidden in zooms that we had to parse in the setup stage
      while (endIndex < len + startingOffset) {
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the featureCode that was stored there
        subCondition = (u32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        index++;
        index += u32(layerCode[index]) >> 10;
        endIndex = index + 1;
      }
    } else if (condition == 6) { // feature-state
      // iterate through subConditions until it matches "uFeatureState"
      // once found, inject
      res = vec4<f32>(0., 0., 0., 1.);
      return res;
    } else if (condition == 7) { // animation-state

    }

    continuing {
      // if our stackIndex is done or we went to far (bug) then we break
      break if (stackIndex <= 0 || stackIndex > 5);
    }
  }

  // update index to the next Layer property
  *indexPtr = featureSize + decodeOffset;
  *featureIndexPtr = featureIndex;

  // if lch: convert back to rgb
  if (color && layer.useLCH != 0.) { res = LCH2RGB(res); }
  // assuming user has selected a colorblind state, adjust accordingly
  if (color && view.cBlind != 0.) { res = cBlindAdjust(res); }

  return res;
}

fn median(r: f32, g: f32, b: f32) -> f32 {
  return max(min(r, g), min(max(r, g), b));
}

const UVs = array<vec2<f32>, 6>(
  vec2(0., 0.),
  vec2(1., 0.),
  vec2(0., 1.),
  vec2(1., 0.),
  vec2(1., 1.),
  vec2(0., 1.)
);

const MAX_GAMMA = 0.105;
const MIN_GAMMA = 0.0525;
const ICON_GAMMA = 0.08;

/* DRAW PASS */

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) st: vec2<f32>,
  @location(1) xy: vec2<f32>,
  @location(2) offset: vec2<f32>,
  @location(3) wh: vec2<f32>,
  @location(4) texXY: vec2<f32>,
  @location(5) texWH: vec2<f32>,
  @location(6) collisionIndex: u32, // index to check in collisionResults
  @location(7) iconColor: vec4<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let uv = UVs[VertexIndex];
  let uIsIcon = glyph.isIcon == 1.;

  // check if collision then we just return
  if (collisionResultsReadOnly[collisionIndex + glyph.indexOffset] != 0u) { return output; }

  // setup position
  var tmpPos = getPos(st);
  tmpPos /= tmpPos.w;
  var tmpPosXY = tmpPos.xy;

  var index = 0u;
  var featureIndex = 0u;

  // decode properties
  var tmpSize = decodeFeature(false, &index, &featureIndex)[0];
  if (uIsIcon) { tmpSize = decodeFeature(false, &index, &featureIndex)[0]; }
  else { _ = decodeFeature(false, &index, &featureIndex)[0]; }
  var size = tmpSize * view.devicePixelRatio * 2.;
  // color
  var color = decodeFeature(true, &index, &featureIndex);
  if (uIsIcon) { color = cBlindAdjust(iconColor); }
  // stroke properties
  output.buf = 0.5;
  if (isStroke == 1.) {
    var strokeWidth = decodeFeature(false, &index, &featureIndex)[0];
    if (strokeWidth > 0.) {
      color = decodeFeature(true, &index, &featureIndex);
      output.buf = 1. - clamp(0.5 + (strokeWidth / 2.), 0.5, 0.999); // strokeWidth is 0->1
    } else { return output; }
  }
  output.color = vec4<f32>(color.rgb * color.a, color.a);

  // set gamma based upon size
  output.gamma = ICON_GAMMA;
  if (!uIsIcon) {
    output.gamma = max(
      MIN_GAMMA,
      min(
        MAX_GAMMA,
        ((MAX_GAMMA - MIN_GAMMA) / (15. - 30.)) * (tmpSize - 15.) + MAX_GAMMA
      )
    );
  }

  // add x-y offset as well as use the UV to map the quad
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var XY = (xy + (offset * size)) / uAspect; // setup the xy positional change in pixels
  var quad = (wh * size) / uAspect * uv;
  tmpPosXY += XY + quad;
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  var uTexSize = vec2<f32>(textureDimensions(glyphTexture));
  output.texcoord = (texXY / uTexSize) + (texWH / uTexSize * uv);
  // output.texcoord = uv;

  output.Position = vec4(tmpPosXY, layer.depthPos, 1.0);

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  if (output.color.a < 0.01) { discard; }
  let tex = textureSample(glyphTexture, glyphSampler, output.texcoord);
  if (tex.a < 0.01) { discard; }
  var opacityS = smoothstep(output.buf - output.gamma, output.buf + output.gamma, median(tex.r, tex.g, tex.b));
  return opacityS * output.color;
  // return output.color;
}

/* TEST PASS */

const TestPos = array<vec2<f32>, 8>(
  // 1
  vec2(0., 0.),
  vec2(1., 0.),
  // 2
  vec2(1., 0.),
  vec2(1., 1.),
  // 3
  vec2(1., 1.),
  vec2(0., 1.),
  // 4
  vec2(0., 1.),
  vec2(0., 0.)
);

@vertex
fn vTest(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) st: vec2<f32>,
  @location(1) xy: vec2<f32>,
  @location(2) pad: vec2<f32>,
  @location(3) wh: vec2<f32>,
  @location(4) collisionIndex: u32, // index to check in collisionResults
) -> TestOutput {
  var output: TestOutput;
  let uv = TestPos[VertexIndex];
  let uIsIcon = glyph.isIcon == 1.;

  // check if collision then we just return
  var color = vec4<f32>(1., 0., 0., 1.); // Collsion is red
  let collision = collisionResultsReadOnly[collisionIndex + glyph.indexOffset];
  if (collision == 0u) { // No collision is green
    color = vec4<f32>(0., 1., 0., 1.);
  } else if (collision == 2u) { // Out of bounds is blue
    color = vec4<f32>(0., 0., 1., 0.15);
  }

  // setup position
  var tmpPos = getPos(st);
  tmpPos /= tmpPos.w;
  var tmpPosXY = tmpPos.xy;

  var index = 0u;
  var featureIndex = 0u;

  // decode properties
  var tmpSize = decodeFeature(false, &index, &featureIndex)[0];
  if (uIsIcon) { tmpSize = decodeFeature(false, &index, &featureIndex)[0]; }
  var size = tmpSize * view.devicePixelRatio * 2.;

  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var padding = pad * view.devicePixelRatio * 2.;
  var XY = ((xy * size) - padding) / uAspect; // setup the xy positional change in pixels
  var WH = ((wh * size) + (padding * 2)) / uAspect;
  tmpPosXY += XY + (WH * uv);

  output.color = color;
  output.Position = vec4<f32>(tmpPosXY, layer.depthPos, 1.0);

  return output;
}

@fragment
fn fTest(
  output: TestOutput
) -> @location(0) vec4<f32> {
  if (output.color.a < 0.01) { discard; }
  return output.color;
}

/* COMPUTE FILTER PASSES */

fn boxesOverlap(a: BBox, b: BBox) -> bool {
  if (a.left >= b.right || b.left >= a.right) { return false; }
  else if (a.top <= b.bottom || b.top <= a.bottom) { return false; }
  return true;
}

// PASS 1: Get positional data for each glyph and store in bboxes.
// Find early collisions (behind S2 sphere or outside tile bounds)
@compute @workgroup_size(64)
fn boxes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= arrayLength(&containers)) { return; }
  let container = containers[global_id.x];
  let bboxIndex = global_id.x + glyph.indexOffset;
  let resultIndex = container.index + glyph.indexOffset;
  let bbox = &bboxes[bboxIndex];
  var position = getPos(container.st);
  let zero = getZero();
  // adjust by w to match zero
  position /= position.w;

  // reset bbox
  (*bbox).index = resultIndex;
  (*bbox).left = 0.;
  (*bbox).bottom = 0.;
  (*bbox).right = 0.;
  (*bbox).top = 0.;

  // First check that we don't already have collisions
  var hasCollision: bool = false;
  // Case 1: The point lies behind the sphere (if s2)
  if (tile.isS2 == 1. && position.z > zero.z) {
    hasCollision = true;
  } else if ( // Case 2: The point lies outside the bounds of the tile (if a child tile)
    container.st.x < bounds.left ||
    container.st.x > bounds.right ||
    container.st.y < bounds.bottom ||
    container.st.y > bounds.top
  ) {
    hasCollision = true;
  }

  if (hasCollision) {
    // update collision state
    atomicStore(&collisionResults[resultIndex], 2u);
    return;
  }
  // otherwise no collision
  atomicStore(&collisionResults[resultIndex], 0u);

  // figure out the size of the glyph
  var index = 0u;
  var featureIndex = 0u;
  // grab the size
  var size = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio * 2.;

  // build bbox
  // tmpPosXY += XY + (WH * uv);
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var padding = container.pad  * view.devicePixelRatio * 2.;
  var XY = ((container.xy * size) - padding) / uAspect; // setup the xy positional change in pixels
  var WH = ((container.wh * size) + (padding * 2)) / uAspect;
  var bottomLeft = position.xy + XY;
  var topRight = bottomLeft + WH;
  // store
  (*bbox).left = bottomLeft.x;
  (*bbox).bottom = bottomLeft.y;
  (*bbox).right = topRight.x;
  (*bbox).top = topRight.y;
}

// PASS 2: Check for collisions between computed bboxes
@compute @workgroup_size(64)
fn test(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let bboxIndex = global_id.x;
  if (bboxIndex >= arrayLength(&bboxes)) { return; }
  let box = bboxes[bboxIndex];
  let resultIndex = box.index;

  // Test for collisions
  // Case 1: Bbox has already "collided" with either the S2 sphere or tile bounds
  if (atomicLoad(&collisionResults[resultIndex]) != 0u) {
    // TODO: overdraw needs to be stored inside the bbox
  } else if (glyph.overdraw == 0.) { // Case 2: Check against other BBoxes at an index before this one if overdraw is off
    var i = 0u;
    loop {
      if (i >= bboxIndex) { break; }
      let testBox = bboxes[i];
      // faster way to check if testBox is empty
      if (testBox.left == 0. && testBox.right == 0.) { i++; continue; }
      let otherResultIndex = testBox.index;
      // 1) don't check against other boxes with the same index
      // 2) check if collision
      // 3) then check the lower indexed filter result isn't already collided with something else
      if (
        otherResultIndex != resultIndex &&
        boxesOverlap(testBox, box) &&
        atomicLoad(&collisionResults[otherResultIndex]) == 0u
      ) {
        // update collision state
        atomicStore(&collisionResults[resultIndex], 1u);
        break;
      }
      i++;
    }
  }
}

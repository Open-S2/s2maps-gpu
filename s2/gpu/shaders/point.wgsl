const PI = 3.141592653589793238;

struct VertexOutput {
  @builtin(position) Position : vec4<f32>,
  @location(0) color : vec4<f32>,
  @location(1) extent: vec2<f32>,
  @location(2) stroke: vec4<f32>,
  @location(3) radius: f32,
  @location(4) strokeWidth: f32,
  @location(5) antialiasFactor: f32,
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
  topRight: vec2<f32>
};

struct LayerUniforms {
  depthPos: f32,
  useLCH: f32, // use LCH coloring or RGB if false
};

struct Bounds {
  bottomLeft: vec2<f32>,
  topRight: vec2<f32>,
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
@binding(3) @group(1) var<storage, read> layerCode: array<f32, 128>;
// ** FEATURE DATA **
// every feature will have it's own code to parse it's attribute data in real time
@binding(4) @group(1) var<storage, read> featureCode: array<f32, 64>;
// ** POINT DATA **
@binding(0) @group(2) var<uniform> bounds: Bounds;

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
  var _r = 0.;
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
        if (inputVal == conditionInput) { break; }
        // increment index & find length
        index += (u32(layerCode[index + 1]) >> 10) + 1;
        conditionInput = layerCode[index];
        // if we hit the default, than the value does not exist
        if (conditionInput == 0.) { break; }
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

const Inputs = array<vec2<f32>, 6>(
  vec2(-1., -1.),
  vec2(1., -1.),
  vec2(-1., 1.),
  vec2(1., -1.),
  vec2(1., 1.),
  vec2(-1., 1.)
);

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) position : vec2<f32>
) -> VertexOutput {
  var output : VertexOutput;

  var extent = Inputs[VertexIndex];

  if (
    position.x < bounds.bottomLeft.x ||
    position.x > bounds.topRight.x ||
    position.y < bounds.bottomLeft.y ||
    position.y > bounds.topRight.y
  ) { return output; }
  // set color
  // prep layer index and feature index positions
  var index = 0u;
  var featureIndex = 0u;
  // decode attributes
  var radius = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;
  var strokeWidth = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;
  var opacity = decodeFeature(false, &index, &featureIndex)[0];
  var color = decodeFeature(true, &index, &featureIndex);
  var stroke = decodeFeature(true, &index, &featureIndex);
  color = vec4<f32>(color.rgb * color.a * opacity, color.a * opacity);
  stroke = vec4<f32>(stroke.rgb * stroke.a * opacity, stroke.a * opacity);

  // get position
  var outPos = getPos(position);
  var zero = getZero();
  // adjust by w
  outPos /= outPos.w;
  zero /= zero.w;
  // if point is behind sphere, drop it.
  if (outPos.z > zero.z) { color.a = 0.; }
  // move to specific corner of quad
  let outPosXY = outPos.xy + extent * (radius + strokeWidth) / vec2<f32>(view.aspectX, view.aspectY);

  // set paint properties
  output.radius = radius;
  output.color = color;
  output.stroke = stroke;
  output.strokeWidth = strokeWidth;
  // set extent
  output.extent = extent;
  // set antialias factor
  output.antialiasFactor = -1. / ((radius + strokeWidth) / view.devicePixelRatio);
  // set position
  output.Position = vec4<f32>(outPosXY, layer.depthPos, 1.0);

  return output;
}

@fragment
fn fMain(
  output : VertexOutput
) -> @location(0) vec4<f32> {
  if (output.color.a < 0.01) { discard; }
  var extentLength = length(output.extent);

  var opacityT = smoothstep(0., output.antialiasFactor, extentLength - 1.);
  if (opacityT < 0.01) { discard; }

  var colorT = 0.;
  if (output.strokeWidth >= 0.01) {
    colorT = smoothstep(
      output.antialiasFactor,
      0.,
      extentLength - output.radius / (output.radius + output.strokeWidth)
    );
  }

  return opacityT * mix(output.color, output.stroke, colorT);
}

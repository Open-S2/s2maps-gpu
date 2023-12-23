const PI = 3.141592653589793238;

struct TextureOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) extent: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) extent: vec2<f32>,
  @location(1) opacity: f32,
  @location(2) shadowColor: vec4<f32>,
  @location(3) accentColor: vec4<f32>,
  @location(4) highlightColor: vec4<f32>,
  @location(5) azimuth: f32,
  @location(6) altitude: f32,
  @location(7) exaggeration: f32,
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
  mouseX: f32,
  mouseY: f32,
  deltaMouseX: f32,
  deltaMouseY: f32,
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
// ** HILLSHADE DATA **
@binding(0) @group(2) var<uniform> hillshadeFade: f32;
@binding(1) @group(2) var imageSampler: sampler;
@binding(2) @group(2) var demTexture: texture_2d<f32>;
// ** POST PROCESSING DATA **
@binding(0) @group(3) var imageTexture: texture_2d<f32>;

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

fn stToUV (s: f32) -> f32 {
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (s >= 0.5) { return (1. / 3.) * (4. * s * s - 1.); }
  else { return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s)); }
}

fn stToXYZ (st: vec2<f32>) -> vec4<f32> { // x -> s, y -> t
  // prep xyz
  var xyz = vec3<f32>();
  // convert to uv
  let uv = vec2<f32>(
    stToUV(tile.deltaS * st.x + tile.sLow), // deltaS * sPos + sLow
    stToUV(tile.deltaT * st.y + tile.tLow) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (tile.face == 0.) { xyz = vec3(uv.x, uv.y, 1.); }
  else if (tile.face == 1.) { xyz = vec3(1., uv.y, -uv.x); }
  else if (tile.face == 2.) { xyz = vec3(-uv.y, 1., -uv.x); }
  else if (tile.face == 3.) { xyz = vec3(-uv.y, -uv.x, -1.); }
  else if (tile.face == 4.) { xyz = vec3(-1., -uv.x, uv.y); }
  else { xyz = vec3(uv.x, -1., uv.y); }
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

fn getPosLocal (pos: vec2<f32>) -> vec4<f32> {
  // find position following s
  var deltaBottom = tilePos.bottomRight - tilePos.bottomLeft;
  var deltaTop = tilePos.topRight - tilePos.topLeft;
  var bottomPosS = tilePos.bottomLeft + deltaBottom * pos.x;
  var topPosS = tilePos.topLeft + deltaTop * pos.x;
  // using s positions, find t
  var deltaS = topPosS - bottomPosS;
  var res = bottomPosS + deltaS * pos.y;
  return vec4(res, 0., 1.);
}

fn getPos (pos: vec2<f32>) -> vec4<f32> {
  if (tile.isS2 == 0. || view.zoom >= 12.) {
    return getPosLocal(pos);
  } else {
    return matrix * stToXYZ(pos);
  }
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

fn decodeFeature (color: bool, indexPtr: ptr<function, i32>, featureIndexPtr: ptr<function, i32>) -> vec4<f32> {
  let uInputs = array<f32, 10>(view.zoom, view.lon, view.lat, view.bearing, view.pitch, view.time, view.aspectX, view.aspectY, view.featureState, view.curFeature);
  // prep result and variables
  var index = i32(*indexPtr);
  var featureIndex = i32(*featureIndexPtr);
  var decodeOffset = index;
  var startingOffset = index;
  var featureSize = i32(layerCode[index]) >> 10;
  var res = vec4<f32>(-1., -1., -1., -1.);
  var conditionStack = array<i32, 6>();
  var tStack = array<f32, 6>();
  var stackIndex = i32(1); // start at 1 because our loop decrements this at start
  conditionStack[0] = index;
  var len = 0;
  var conditionSet = 0;
  var condition = 0;

  loop {
    stackIndex--;
    // pull out current stackIndex condition an decode
    index = conditionStack[stackIndex];
    startingOffset = index;
    conditionSet = i32(layerCode[index]);
    len = conditionSet >> 10;
    condition = (conditionSet & 1008) >> 4;
    index++;
    // for each following condition, pull out the eventual color and set to val
    if (condition == 0) {
    } else if (condition == 1) { // value
      if (res[0] == -1.) {
        for (var i = 0; i < len - 1; i++) {
          res[i] = f32(layerCode[index + i]);
        }
      } else {
        if (color) {
          var val = vec4<f32>(layerCode[index], layerCode[index + 1], layerCode[index + 2], layerCode[index + 3]);
          res = interpolateColor(res, val, tStack[stackIndex]);
        } else {
          for (var i = 0; i < len - 1; i++) {
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
      while (inputVal != conditionInput) {
        // increment index & find length
        index += (i32(layerCode[index + 1]) >> 10) + 1;
        conditionInput = layerCode[index];
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
      var startIndex = 0;
      var endIndex = 0;
      var subCondition = 0;
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
        subCondition = (i32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        // increment to subCondition
        index++;
        // increment by subConditions length
        index += i32(layerCode[index]) >> 10;
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
        subCondition = (i32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        index++;
        index += i32(layerCode[index]) >> 10;
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

@vertex
fn vTexture(
  @location(0) position: vec2<f32>
) -> TextureOutput {
  var output: TextureOutput;
  var tmpPos = getPos(position);
  tmpPos /= tmpPos.w;
  output.Position = vec4(tmpPos.xy, layer.depthPos, 1.);
  output.extent = position;
  return output;
}

@fragment
fn fTexture(
  output: TextureOutput
) -> @location(0) f32 {
  var color = textureSample(demTexture, imageSampler, output.extent);
  return -10000. + ((color.r * 256. * 256. + color.g * 256. + color.b) * 0.1);
}

const Extents = array<vec2<f32>, 6>(
  vec2(-1., -1.),
  vec2(1., -1.),
  vec2(-1., 1.),
  vec2(1., -1.),
  vec2(1., 1.),
  vec2(-1., 1.)
);

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32
) -> VertexOutput {
  var output: VertexOutput;
  let extent = Extents[VertexIndex];
  output.Position = vec4<f32>(extent, layer.depthPos, 1.);
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  // set where we are on the texture
  output.extent = extent * 0.5 + 0.5;
  // invert the y
  output.extent.y = 1. - output.extent.y;
  // apply aspect ratio
  output.extent *= uAspect;

  var index = 0;
  var featureIndex = 0;

  output.opacity = decodeFeature(false, &index, &featureIndex)[0];
  output.shadowColor = decodeFeature(true, &index, &featureIndex);
  output.accentColor = decodeFeature(true, &index, &featureIndex);
  output.highlightColor = decodeFeature(true, &index, &featureIndex);
  output.azimuth = min(max(decodeFeature(false, &index, &featureIndex)[0], 0.), 360.) * PI / 180;
  output.altitude = min(max(decodeFeature(false, &index, &featureIndex)[0], 0.), 90.) / 90.;

  output.exaggeration = 0.;
  if (view.zoom < 15.0) {
    var exaggerationFactor = 0.3;
    if (view.zoom < 2.0) { exaggerationFactor = 0.4; } else if (view.zoom < 4.5) { exaggerationFactor = 0.35; }
    output.exaggeration = (view.zoom - 15.0) * exaggerationFactor;
  }

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  // load 3x3 window
  let texCoord = vec2<i32>(output.extent);
  let a = textureLoad(imageTexture, texCoord + vec2<i32>(-1, -1), 0).r;
  let b = textureLoad(imageTexture, texCoord + vec2<i32>(0, -1), 0).r;
  let c = textureLoad(imageTexture, texCoord + vec2<i32>(1, -1), 0).r;
  let d = textureLoad(imageTexture, texCoord + vec2<i32>(-1, 0), 0).r;
  let e = textureLoad(imageTexture, texCoord, 0).r;
  let f = textureLoad(imageTexture, texCoord + vec2<i32>(1, 0), 0).r;
  let g = textureLoad(imageTexture, texCoord + vec2<i32>(-1, 1), 0).r;
  let h = textureLoad(imageTexture, texCoord + vec2<i32>(0, 1), 0).r;
  let i = textureLoad(imageTexture, texCoord + vec2<i32>(1, 1), 0).r;

  let dzDx = ((c + f + f + i) - (a + d + d + g)) / pow(2., output.exaggeration + (19.2562 - view.zoom));
  let dzDy = (g + h + h + i) - (a + b + b + c);

  // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
    // to account for mercator projection distortion. see #4807 for details
    // TODO:
    // let scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1. - v_pos.y) + u_latrange[1]));
    let scaleFactor = 20.;
    // We also multiply the slope by an arbitrary z-factor of 1.25
    let slope = atan(1.25 * length(vec2(dzDx, dzDy)) / scaleFactor);
    // let aspect = deriv.x != 0. ? atan(dzDy, -dzDy) : PI / 2. * (dzDy > 0. ? 1. : -1.);
    var aspectDelta = -1.;
    if (dzDy > 0.) { aspectDelta = 1.; }
    var aspect = PI / 2. * aspectDelta;
    if (dzDx != 0.) { aspect = atan2(dzDy, -dzDx); }

    // We add PI to make this property match the global light object, which adds PI/2 to the light's azimuthal
    // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
    // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
    let azimuth = output.azimuth + PI;

    // We scale the slope exponentially based on altitude, using a calculation similar to
    // the exponential interpolation function in the style spec:
    // src/style-spec/expression/definitions/interpolate.js#L217-L228
    // so that higher altitude values create more opaque hillshading.
    let base = 1.875 - output.altitude * 1.75;
    let maxValue = 0.5 * PI;
    var scaledSlope = slope;
    if (output.altitude != 0.5) {
      scaledSlope = ((pow(base, slope) - 1.) / (pow(base, maxValue) - 1.)) * maxValue;
    }

    // The accent color is calculated with the cosine of the slope while the shade color is calculated with the sine
    // so that the accent color's rate of change eases in while the shade color's eases out.
    let accent = cos(scaledSlope);
    // We multiply both the accent and shade color by a clamped altitude value
    // so that intensities >= 0.5 do not additionally affect the color values
    // while altitude values < 0.5 make the overall color more transparent.
    let accentColor = (1. - accent) * output.accentColor * clamp(output.altitude * 2., 0., 1.);
    let shade = abs((((aspect + azimuth) / PI + 0.5) % 2.) - 1.);
    let shadeColor = mix(output.shadowColor, output.highlightColor, shade) * sin(scaledSlope) * clamp(output.altitude * 2., 0., 1.);
    return (accentColor * (1. - shadeColor.a) + shadeColor) * output.opacity * hillshadeFade;
}

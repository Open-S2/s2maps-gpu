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

// https://webgpufundamentals.org/webgpu/lessons/resources/wgsl-offset-computer.html
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

// Terrarium unpack formula:
// https://s3.amazonaws.com/elevation-tiles-prod/terrarium/6/6/24.png
// return (color.r * 256. + color.g + color.b / 256.) - 32768.;
// Mapbox unpack formula:
// return ((color.r * 256. * 256. + color.g * 256. + color.b) * 0.1) - 10000.;
// Variable names:
// return ((color.r * rMultiplier + color.g * gMultiplier + color.b * gMultiplier + color.a * aMultiplier) * zFactor) + offset;
struct UnpackUniforms {
  offset: f32,
  zFactor: f32,
  rMultiplier: f32,
  gMultiplier: f32,
  bMultiplier: f32,
  aMultiplier: f32,
};

#include shared/color.wgsl;
#include shared/getPos.wgsl;
#include shared/decodeFeature.wgsl;

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
@binding(3) @group(2) var<uniform> unpack: UnpackUniforms;

// https://pro.arcgis.com/en/pro-app/latest/tool-reference/3d-analyst/how-hillshade-works.htm
// https://github.com/maplibre/maplibre-gl-js/blob/99d946a4993650db35f4668bc36927ee5214872e/src/shaders/hillshade_prepare.fragment.glsl

fn getElevation(
  uv: vec2<f32>,
) -> f32 {
  var color = textureSample(demTexture, imageSampler, uv);
  return (
    (
      color.r * unpack.rMultiplier +
      color.g * unpack.gMultiplier +
      color.b * unpack.bMultiplier +
      color.a * unpack.aMultiplier
    )
    * unpack.zFactor
  ) + unpack.offset;
}

@vertex
fn vMain(
  @location(0) position: vec2<f32>
) -> VertexOutput {
  var output: VertexOutput;
  var tmpPos = getPos(position);
  tmpPos /= tmpPos.w;
  output.Position = vec4(tmpPos.xy, layer.depthPos, 1.);
  output.extent = position;

  var index = 0;
  var featureIndex = 0;

  output.opacity = decodeFeature(false, &index, &featureIndex)[0];
  output.shadowColor = decodeFeature(true, &index, &featureIndex);
  output.accentColor = decodeFeature(true, &index, &featureIndex);
  output.highlightColor = decodeFeature(true, &index, &featureIndex);
  output.azimuth = min(max(decodeFeature(false, &index, &featureIndex)[0], 0.), 360.) * PI / 180.;
  output.altitude = min(max(decodeFeature(false, &index, &featureIndex)[0], 0.), 90.) / 90.;

  // output.exaggeration = 0.;
  // if (view.zoom < 15.0) {
  //   var exaggerationFactor = 0.3;
  //   if (view.zoom < 2.0) { exaggerationFactor = 0.4; } else if (view.zoom < 4.5) { exaggerationFactor = 0.35; }
  //   output.exaggeration = (view.zoom - 15.0) * exaggerationFactor;
  // }

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  // load 3x3 window
  let texLength = f32(textureDimensions(demTexture).x);
  let cellSize = 1. / texLength;
  // adjust extent to go from 0-1 to not include the edges since the texture is oversized
  let uv = output.extent * ((texLength - 2.) / texLength) + cellSize;
  // cellSize is the length of 0->514; create a uv variable that is extent,
  let a = getElevation(uv + vec2<f32>(-cellSize, -cellSize));
  let b = getElevation(uv + vec2<f32>(0., -cellSize));
  let c = getElevation(uv + vec2<f32>(cellSize, -cellSize));
  let d = getElevation(uv + vec2<f32>(-cellSize, 0.));
  let e = getElevation(uv);
  let f = getElevation(uv + vec2<f32>(cellSize, 0.));
  let g = getElevation(uv + vec2<f32>(-cellSize, cellSize));
  let h = getElevation(uv + vec2<f32>(0., cellSize));
  let i = getElevation(uv + vec2<f32>(cellSize, cellSize));

  // let multiplier = pow(2., output.exaggeration + (19.2562 - view.zoom));
  let dzDx = (c + f + f + i) - (a + d + d + g);
  let dzDy = (g + h + h + i) - (a + b + b + c);

  // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
  // to account for mercator projection distortion. see #4807 for details
  // TODO:
  // let scaleFactor = cos(radians((u_latrange[0] - u_latrange[1]) * (1. - v_pos.y) + u_latrange[1]));
  let scaleFactor = 10.;
  // We also multiply the slope by an arbitrary z-factor of 1.25
  let slope = atan(1.25 * length(vec2<f32>(dzDx, dzDy)) / scaleFactor);
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
  // We multiply both the accent and shade color by a clamped altitude value
  // so that intensities >= 0.5 do not additionally affect the color values
  // while altitude values < 0.5 make the overall color more transparent.
  let clampedAltitude = clamp(output.altitude * 2., 0., 1.);
  let accentColor = output.accentColor * (1. - cos(scaledSlope)) * clampedAltitude;
  let shade = abs((((aspect + azimuth) / PI + 0.5) % 2.) - 1.);
  let shadeColor = mix(output.shadowColor, output.highlightColor, shade) * sin(scaledSlope) * clampedAltitude;
  return (accentColor * (1. - shadeColor.a) + shadeColor) * output.opacity * hillshadeFade;
}

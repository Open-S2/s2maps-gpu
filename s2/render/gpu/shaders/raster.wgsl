struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) texcoord: vec2<f32>,
  @location(1) opacity: f32,
  @location(2) saturation: f32,
  @location(3) contrast: f32,
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
// ** RASTER DATA **
@binding(0) @group(2) var<uniform> rasterFade: f32;
@binding(1) @group(2) var rasterSampler: sampler;
@binding(2) @group(2) var rasterTexture: texture_2d<f32>;

fn getSaturation (saturation: f32) -> f32 {
  var mutSaturation = saturation;
  mutSaturation = clamp(mutSaturation, -1., 1.);
  if (mutSaturation > 0.) {
    return 1. - 1. / (1.001 - mutSaturation);
  } else {
    return -mutSaturation;
  }
}

fn getContrast (contrast: f32) -> f32 {
  var mutContrast = contrast;
  mutContrast = clamp(mutContrast, -1., 1.);
  if (mutContrast > 0.) {
    return 1. / (1. - mutContrast);
  } else {
    return 1. + mutContrast;
  }
}

@vertex
fn vMain(
  @location(0) position: vec2<f32>
) -> VertexOutput {
  var output: VertexOutput;

  // set where we are on the texture
  output.texcoord = position;

  var index = 0;
  var featureIndex = 0;

  output.opacity = decodeFeature(false, &index, &featureIndex)[0];
  output.saturation = decodeFeature(false, &index, &featureIndex)[0];
  output.contrast = decodeFeature(false, &index, &featureIndex)[0];

  // set position
  var tmpPos = getPos(position);
  tmpPos /= tmpPos.w;
  output.Position = vec4(tmpPos.xy, layer.depthPos, 1.);

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  var color = textureSample(rasterTexture, rasterSampler, output.texcoord);

  // saturation
  var average = (color.r + color.g + color.b) / 3.0;
  var sat = (average - color.rgb) * -getSaturation(output.saturation);
  color = vec4<f32>(color.rgb + sat, color.a);
  // contrast
  var contrast = (color.rgb - 0.5) * getContrast(output.contrast) + 0.5;
  color = vec4<f32>(contrast, color.a);
  // opacity
  color *= output.opacity * rasterFade;

  return color;
}

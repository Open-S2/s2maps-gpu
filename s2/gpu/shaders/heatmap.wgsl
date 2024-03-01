struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) extent: vec2<f32>,
  @location(1) opacity: f32,
  @location(2) strength: f32,
};

struct TextureOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) extent: vec2<f32>,
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

struct Bounds {
  left: f32,
  bottom: f32,
  right: f32,
  top: f32,
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
// ** POINT DATA **
@binding(0) @group(2) var<uniform> bounds: Bounds;
@binding(1) @group(2) var imageSampler: sampler;
@binding(2) @group(2) var imageTexture: texture_2d<f32>;
@binding(3) @group(2) var colorRamp: texture_2d<f32>;

const Extents = array<vec2<f32>, 6>(
  vec2(-1., -1.),
  vec2(1., -1.),
  vec2(-1., 1.),
  vec2(1., -1.),
  vec2(1., 1.),
  vec2(-1., 1.)
);

const ZERO = 0.00196078431372549; // 1. / 255. / 2.
const GAUSS_COEF = 0.3989422804014327;

@vertex
fn vTexture(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) position: vec2<f32>,
  @location(1) weight: f32,
) -> VertexOutput {
  var output: VertexOutput;
  var extent = Extents[VertexIndex];
  var outPosXY = vec2<f32>(0., 0.);

  if (
    position.x < bounds.left ||
    position.x > bounds.right ||
    position.y < bounds.bottom ||
    position.y > bounds.top
  ) { return output; }
  // prep layer index and feature index positions
  var index = 0;
  var featureIndex = 0;
  // decode attributes
  var radius = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio * 2.;
  output.opacity = decodeFeature(false, &index, &featureIndex)[0];
  var intensity = decodeFeature(false, &index, &featureIndex)[0];

  // prep position & zero
  var outPos = getPos(position);
  var zero = getZero();
  // adjust by w
  outPos /= outPos.w;
  zero /= zero.w;
  // set initial xy
  outPosXY = outPos.xy;
  // if point is behind sphere, drop it.
  if (outPos.z > zero.z) {
    outPosXY = vec2<f32>(0., 0.);
    output.strength = 0.;
  } else {
    // move to specific corner of quad
    outPosXY += extent * radius / vec2<f32>(view.aspectX, view.aspectY);
    // set strength
    extent *= sqrt(-2. * log(ZERO / weight / intensity / GAUSS_COEF)) / 3.;
    output.extent = extent;
    output.strength = weight * intensity * GAUSS_COEF;
  }

  // set position
  output.Position = vec4<f32>(outPosXY, 0.0, 1.0);

  return output;
}

@fragment
fn fTexture(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  var d = -0.5 * 3. * 3. * dot(output.extent, output.extent);
  var val = output.strength * exp(d);
  return vec4<f32>(val * output.opacity, 1., 1., 1.);
}

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32
) -> TextureOutput {
  var output: TextureOutput;

  var input = Extents[VertexIndex];
  output.Position = vec4<f32>(input, layer.depthPos, 1.);
  output.extent = input * 0.5 + 0.5;
  // invert the y
  output.extent.y = 1. - output.extent.y;

  return output;
}

@fragment
fn fMain(
  output: TextureOutput,
) -> @location(0) vec4<f32> {
  var t = textureSample(imageTexture, imageSampler, output.extent).r;
  if (t < 0.01) { discard; }
  return textureSample(colorRamp, imageSampler, vec2<f32>(t, view.cBlind / 4.));
}

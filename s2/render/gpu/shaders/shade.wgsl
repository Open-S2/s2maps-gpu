struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) localPos: vec4<f32>,
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

// TODO: We can use uniforms that the user can set
// struct ShadeUniforms {
//   fadeStep: vec2<f32>, // default: vec2(0., 0.325)
//   nullColor: vec4<f32>, // default: vec4(1.)
//   darkColor: vec4<f32>, // default: vec4(0.6, 0.6, 0.6, 1.)
// };

#include shared/getPos.wgsl;

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

const FadeStep = vec2<f32>(0., 0.325);
const NullColor = vec4<f32>(1.);
const DarkColor = vec4<f32>(0.6, 0.6, 0.6, 1.);

@vertex
fn vMain(
  @location(0) inPos: vec2<f32>,
) -> VertexOutput {
  var output: VertexOutput;

  // setup position
  var pos = getPos(inPos);
  pos /= pos.w;
  output.Position = vec4(pos.xy, layer.depthPos, 1.0);

  // get aspect ratio
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  // modify aspect to be a ratio of
  var zoom = 0.;
  if (view.zoom < 0.) {
    zoom = view.zoom / 1.45;
  } else { zoom = view.zoom; }
  var radius = uAspect / (view.devicePixelRatio * 2.) / ((zoom / 1.35) + 1.) / 500.;
  // get pixel distance
  var localPos = pos.xy;
  // scale
  localPos *= radius;
  // add offset
  localPos += vec2<f32>(300., -175.) / uAspect;

  output.localPos = vec4<f32>(localPos, 0., 1.);
  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  // get distance from center
  var len = length(output.localPos.xy);
  // fade out
  var fade = smoothstep(FadeStep.x, FadeStep.y, 1.0 - len);
  // mix colors
  return mix(DarkColor, NullColor, fade);
}

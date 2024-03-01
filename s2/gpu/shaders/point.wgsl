struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
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

struct Interactive {
  offset: u32,
  count: u32,
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
@binding(1) @group(2) var<uniform> interactiveAttributes: Interactive;
@binding(2) @group(2) var<storage, read> interactivePos: array<vec2<f32>>;
@binding(3) @group(2) var<storage, read> interactiveID: array<u32>;
// ** INTERACTIVE DATA **
@binding(0) @group(3) var<storage, read_write> resultIndex: atomic<u32>;
@binding(1) @group(3) var<storage, read_write> results: array<u32>;

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
  @location(0) position: vec2<f32>
) -> VertexOutput {
  var output: VertexOutput;

  var extent = Inputs[VertexIndex];

  if (
    position.x < bounds.left ||
    position.x > bounds.right ||
    position.y < bounds.bottom ||
    position.y > bounds.top
  ) { return output; }
  // set color
  // prep layer index and feature index positions
  var index = 0;
  var featureIndex = 0;
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
  output: VertexOutput
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

@compute @workgroup_size(64)
fn interactive(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let id = global_id.x + interactiveAttributes.offset;
  if (global_id.x >= interactiveAttributes.count) { return; }
  var tilePos = interactivePos[id];
  var pos = getPos(tilePos);
  let zero = getZero();
  let featureID = interactiveID[id];

  // adjust by w
  pos /= pos.w;
  // if point is behind sphere, drop it.
  if (pos.z > zero.z) { return; }
  // if point outside bounds, drop it.
  if (
    tilePos.x < bounds.left ||
    tilePos.x > bounds.right ||
    tilePos.y < bounds.bottom ||
    tilePos.y > bounds.top
  ) { return; }

  // grab radius
  var index = 0;
  var featureIndex = 0;
  let radius = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;
  let strokeWidth = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;
  // convert to screen space for x and y
  let aspect = vec2<f32>(view.aspectX, view.aspectY);
  let posScreen = (pos.xy + 1.) / 2. * aspect;
  let mouse = (vec2<f32>(view.mouseX, view.mouseY) + 1.) / 2. * aspect;

  // if mouseX,mouseY is outside of point+radius, drop it.
  if (length(posScreen - mouse) > (radius + strokeWidth)) { return; }

  // otherwise add results
  results[atomicAdd(&resultIndex, 1u)] = featureID;
}

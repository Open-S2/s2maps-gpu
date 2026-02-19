struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) alpha: f32,
  @location(2) uv: vec2<f32>,
  @location(3) deltaMouse: vec2<f32>,
  @location(4) tileFactor: vec2<f32>,
  @location(5) regionPos: vec2<f32>,
  @location(6) regionSize: vec2<f32>,
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

struct Interactive {
  offset: u32,
  count: u32,
};

struct TriangleIndexes {
  a: u32,
  b: u32,
  c: u32,
};

struct Pattern {
  texX: f32,
  texY: f32,
  texW: f32,
  texH: f32,
  movement: f32, // boolean 0 or 1
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
// ** FILL DATA **
@binding(0) @group(2) var<uniform> interactiveAttributes: Interactive;
@binding(1) @group(2) var<storage, read> interactivePos: array<vec2<f32>>;
@binding(2) @group(2) var<storage, read> interactiveIndex: array<TriangleIndexes>;
@binding(3) @group(2) var<storage, read> interactiveID: array<u32>; // ID of the feature
@binding(4) @group(2) var<uniform> pattern: Pattern;
@binding(5) @group(2) var patternSampler: sampler;
@binding(6) @group(2) var patternTexture: texture_2d<f32>;
// ** Interactive Data **
@binding(0) @group(3) var<storage, read_write> resultIndex: atomic<u32>;
@binding(1) @group(3) var<storage, read_write> results: array<u32>;

@vertex
fn vMain(
  @location(0) position: vec2<f32>,
  @location(1) codeType: u32,
) -> VertexOutput {
  var output: VertexOutput;

  // setup position
  var tmpPos = getPos(position);
  tmpPos /= tmpPos.w;
  output.Position = vec4(tmpPos.xy, layer.depthPos, 1.0);

  // build UV
  // Convert from clip space to [0, 1] range
  output.uv = (tmpPos.xy + 1.) / 2.;
  let textureSize = vec2<f32>(textureDimensions(patternTexture, 0));
  let aspect = vec2<f32>(view.aspectX, view.aspectY);
  let patternWH = vec2<f32>(pattern.texW, pattern.texH);
  output.regionPos = vec2<f32>(pattern.texX, pattern.texY) / textureSize;
  output.regionSize = patternWH / textureSize;
  // Scale UV coordinates for tiling
  output.tileFactor = aspect / patternWH;
  // prep deltaMouse
  if (pattern.movement == 0.) { output.deltaMouse = vec2<f32>(0., 0.); }
  else { output.deltaMouse = vec2<f32>(view.deltaMouseX, view.deltaMouseY); }

  // set color
  // prep layer index and feature index positions
  var index = 0;
  var featureIndex = i32(codeType);
  // decode color
  var color = decodeFeature(true, &index, &featureIndex);
  color = vec4(color.rgb * color.a, color.a);
  output.color = color;
  output.alpha = decodeFeature(false, &index, &featureIndex)[0];

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  if (pattern.texW == 0. || pattern.texH == 0.) { return output.color * output.alpha; }
  // Calculate UV coordinates within the specified region
  let uv = (((output.uv + output.deltaMouse) * output.tileFactor) % 1.) * output.regionSize + output.regionPos;
  // grab the texture color from the pattern at uv coordinates
  let textureColor = textureSample(patternTexture, patternSampler, uv);
  var blendedColor = textureColor * textureColor.a + output.color * (1. - textureColor.a);
  blendedColor *= output.alpha;

  return blendedColor;
}

@compute @workgroup_size(64)
fn interactive(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let id = global_id.x + interactiveAttributes.offset;
  if (global_id.x >= interactiveAttributes.count) { return; }
  let index = interactiveIndex[id];
  let featureID = interactiveID[id];

  // get Position of each triangle vertex
  var a = getPos(interactivePos[index.a]);
  var b = getPos(interactivePos[index.b]);
  var c = getPos(interactivePos[index.c]);
  // convert to clip space
  a /= a.w;
  b /= b.w;
  c /= c.w;

  // find the area of the triangle
  let area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
  let absArea = abs(area);
  // CW triangles are back facing so we drop
  if (area < 0.) { return; }
  // find the barycentric coordinates of the point
  let s = 1 / (2 * absArea) * (a.y * c.x - a.x * c.y + (c.y - a.y) * view.mouseX + (a.x - c.x) * view.mouseY);
  let t = 1 / (2 * absArea) * (a.x * b.y - a.y * b.x + (a.y - b.y) * view.mouseX + (b.x - a.x) * view.mouseY);
  let u = 1. - s - t;
  // if the point is in the triangle, we add it to the results
  if (s >= 0. && t >= 0. && u >= 0.) {
    results[atomicAdd(&resultIndex, 1u)] = featureID;
  }
}

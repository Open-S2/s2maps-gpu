struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) width: vec2<f32>,
  @location(2) norm: vec2<f32>,
  @location(3) center: vec2<f32>,
  @location(4) drawType: f32,
  @location(5) lengthSoFar: f32,
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

struct LineUniforms {
  cap: f32,
  dashed: f32, // bool
  dashCount: f32,
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
// ** LINE DATA **
@binding(0) @group(2) var<uniform> line: LineUniforms;
@binding(1) @group(2) var dashSampler: sampler;
@binding(2) @group(2) var dashTexture: texture_2d<f32>;

fn isCCW (inPrev: vec2<f32>, inCurr: vec2<f32>, inNext: vec2<f32>) -> bool {
  var det = (inCurr.y - inPrev.y) * (inNext.x - inCurr.x) - (inCurr.x - inPrev.x) * (inNext.y - inCurr.y);

  return det < 0.;
}

// 0 -> curr
// 1 -> curr + (-1 * normal)
// 2 -> curr + (normal)
// 3 -> next + (-1 * normal)
// 4 -> next + (normal)
// 5 -> curr + (normal) [check that prev, curr, and next is CCW otherwise invert normal]
// 6 -> curr + (previous-normal) [check that prev, curr, and next is CCW otherwise invert normal]
const DrawTypes = array<f32, 9>(1, 3, 4, 1, 4, 2, 0, 5, 6);

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) inPrev: vec2<f32>,
  @location(1) inCurr: vec2<f32>,
  @location(2) inNext: vec2<f32>,
  @location(3) lengthSoFar: f32,
) -> VertexOutput {
  var output: VertexOutput;
  let drawType = DrawTypes[VertexIndex];

  // set default lengthSoFar
  output.lengthSoFar = lengthSoFar * pow(2., view.zoom - tile.zoom);

  // return output;
  // prep layer index and feature index positions
  var index = 0;
  var featureIndex = 0;
  let aspectAdjust = vec2<f32>(view.aspectX / view.aspectY, 1.);
  // decode color
  var color = vec4<f32>(0.);
  color = decodeFeature(true, &index, &featureIndex);
  color.a *= decodeFeature(false, &index, &featureIndex)[0];
  color = vec4<f32>(color.rgb * color.a, color.a);
  output.color = color;
  // decode line width
  var width = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;
  // explain width to fragment shader
  output.width = vec2<f32>(width, 0.);
  // get the position in projected space
  var prev = getPos(inPrev);
  var curr = getPos(inCurr);
  var next = getPos(inNext);
  var zero = getZero();
  // adjust by w & get the position in screen space
  curr /= curr.w;
  next /= next.w;
  prev /= prev.w;
  zero /= zero.w;

  var currScreen = curr.xy * aspectAdjust;
  var nextScreen = next.xy * aspectAdjust;
  var prevScreen = prev.xy * aspectAdjust;
  var screen = curr.xy;
  // grab the perpendicular vector
  var normal = vec2<f32>(0.);
  var pos = vec4<f32>(0.);

  if (
    tile.isS2 == 0. ||
    (curr.z < zero.z && next.z < zero.z)
  ) {
    let uAspect = vec2<f32>(view.aspectX, view.aspectY);
    let currPrev = all(curr == prev);
    let currNext = all(curr == next);
    if ( // first case is end caps
      line.cap != 0. &&
      (currPrev || currNext) &&
      (drawType == 0. || drawType == 5. || drawType == 6.)
    ) {
      // set cap type
      output.drawType = line.cap;
      // find center
      output.center = (curr.xy / 2. + 0.5) * uAspect;
      // create normal and adjust if necessary
      if (currPrev) {
        normal = normalize(nextScreen - currScreen);
      } else { normal = normalize(currScreen - prevScreen); }
      var capNormal = normal;
      normal = vec2<f32>(-normal.y, normal.x);
      if (drawType == 0. || drawType == 5.) { normal *= -1.; }
      if (currPrev) { capNormal *= -1.; }
      // adjust screen position if necessary
      if (drawType == 5. || (drawType == 6. && currPrev)) { screen += capNormal * width / uAspect; }
      // set position
      pos = vec4<f32>(screen + normal * width / uAspect, 0., 1.);
    } else { // second case: draw a quad line
      // create normalize
      if (drawType == 0.) { normal = vec2<f32>(0.); }
      else if (drawType == 5.) { normal = normalize(currScreen - prevScreen); }
      else { normal = normalize(nextScreen - currScreen); }
      normal = vec2<f32>(-normal.y, normal.x);
      // adjust normal if necessary
      if (
        drawType == 1. || drawType == 3. ||
        ((drawType == 5. || drawType == 6.) && isCCW(prevScreen, currScreen, nextScreen))
      ) { normal *= -1.; }
      // adjust screen if necessary
      if (drawType == 3. || drawType == 4.) {
        screen = next.xy;
        // also increment lengthSoFar
        let screenDistance = length((next.xy - curr.xy) * uAspect);
        // convert screenDistance to pixels
        output.lengthSoFar += screenDistance;
      }
      // set position
      pos = vec4<f32>(screen + normal * width / uAspect, 0., 1.);
    }
  }
  // tell the fragment the normal vector
  output.norm = normal;
  output.Position = vec4<f32>(pos.xy, layer.depthPos, 1.0);

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  // Calculate the distance of the pixel from the line in pixels.
  var dist = 0.;
  var blur = 0.;
  var startWidth = 0.;
  var endWidth = 0.;
  if (output.drawType <= 1.) {
    dist = length(output.norm) * output.width.x;
    blur = view.devicePixelRatio;
    startWidth = output.width.y;
    endWidth = output.width.x;
  } else {
    dist = distance(output.center, output.Position.xy);
    blur = view.devicePixelRatio / 2.;
    startWidth = output.width.y / 2.;
    endWidth = output.width.x / 2.;
  }
  // AA for width and length
  var wAlpha = clamp(min(dist - (startWidth - blur), endWidth - dist) / blur, 0., 1.);
  if (wAlpha == 0.) { discard; }

  var color = output.color;
  if (line.dashed != 0.) {
    // get texture length
    let texLength = f32(textureDimensions(dashTexture).x);
    color = textureSample(dashTexture, dashSampler, vec2<f32>((output.lengthSoFar % line.dashCount) / texLength, view.cBlind / 4.));
  }
  return color * wAlpha;
}

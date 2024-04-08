struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) color: vec4<f32>,
  @location(1) texcoord: vec2<f32>,
  @location(2) buf: f32,
  @location(3) gamma: f32,
  @location(4) isIcon: f32,
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
  topRight: vec2<f32>,
};

struct LayerUniforms {
  depthPos: f32,
  useLCH: f32, // use LCH coloring or RGB if false
};

struct GlyphUniforms {
  sourceIndexOffset: u32, // where to start searching the collisionResults array
  isPath: f32,
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

struct Attributes {
  offset: u32,
  count: u32,
  isStroke: u32, // 1 for stroke, 0 for fill
};

// to see if it's a shared container (and how many containers it shares with for opacity change)
struct GlyphContainer {
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  xy: vec2<f32>, // xy starting position of the glyph box relative to the final computed position
  offset: vec2<f32>, // offset from the xy position
  pad: vec2<f32>, // padding around the container
  wh: vec2<f32>, // width & height of the container
  index: u32, // index in the collision result array without offset (needed because some Containers share indexes)
  id: u32, // identifier - the last 8 bits explain how many containers it shares with
  _padding: array<f32, 6>, // empty data to match the size of the GlyphContainerPath
};

struct GlyphContainerPath {
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  offset: vec2<f32>, // offset from the xy position
  xy: vec2<f32>, // the x is the distance from the starting position st. The y is the vertical change tangential to the path position
  path: array<vec2<f32>, 4>, // path of st points from the starting position st
  pad: f32, // padding around the container
  index: u32, // index in the collision result array without offset (needed because some Containers share indexes)
  id: u32, // identifier - the last 8 bits explain how many containers it shares with
  _padding: f32,
};

struct BBox {
  index: u32, 
  left: f32,
  bottom: f32,
  right: f32,
  top: f32, // -99999 if actually a circle
};

struct Circle {
  index: u32, 
  x: f32,
  y: f32,
  radius: f32,
};

struct PathPosition {
  xy: vec2<f32>,
  angle: f32
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
// ** GLYPH DATA **
@binding(0) @group(2) var<uniform> bounds: Bounds;
@binding(1) @group(2) var<uniform> glyph: GlyphUniforms;
@binding(2) @group(2) var glyphSampler: sampler;
@binding(3) @group(2) var glyphTexture: texture_2d<f32>;
// the bbox index is the container position + the glyph indexOffset
// the collision result index is the container's index value + the glyph indexOffset
@binding(4) @group(2) var<storage, read> containers: array<GlyphContainer>;
@binding(5) @group(2) var<storage, read> containerPaths: array<GlyphContainerPath>;
@binding(6) @group(2) var<storage, read_write> bboxes: array<BBox>;
@binding(7) @group(2) var<storage, read_write> collisionResults: array<atomic<u32>>;
@binding(8) @group(2) var<storage, read> collisionResultsReadOnly: array<u32>;
@binding(9) @group(2) var<uniform> attributes: Attributes;
// ** Interactive Data **
@binding(0) @group(3) var<storage, read_write> resultIndex: atomic<u32>;
@binding(1) @group(3) var<storage, read_write> results: array<u32>;

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
  @location(1) offset: vec2<f32>,
  @location(2) xy: vec2<f32>,
  @location(3) wh: vec2<f32>,
  @location(4) texXY: vec2<f32>,
  @location(5) texWH: vec2<f32>,
  @location(6) collisionIndex: u32, // index to check in collisionResults
  @location(7) iconColor: vec4<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let uv = UVs[VertexIndex];
  let uIsIcon = glyph.isIcon == 1.;
  output.isIcon = glyph.isIcon;

  // check if collision then we just return
  if (collisionResultsReadOnly[collisionIndex + glyph.sourceIndexOffset] != 0u) { return output; }

  // setup position
  var tmpPos = getPos(st);
  tmpPos /= tmpPos.w;
  var posXY = tmpPos.xy;

  var index = 0;
  var featureIndex = 0;

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
  if (attributes.isStroke == 1u) {
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
  let adjust = offset * view.devicePixelRatio;
  var XY = (adjust + (xy * size)); // setup the xy positional change in pixels
  var quad = (wh * size) * uv;
  posXY += (XY + quad) / uAspect;
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  var uTexSize = vec2<f32>(textureDimensions(glyphTexture));
  output.texcoord = (texXY / uTexSize) + (texWH / uTexSize * uv);
  // output.texcoord = uv;

  output.Position = vec4(posXY, layer.depthPos, 1.0);

  return output;
}

// convert an s-t to a position to screen-space [-1 -> 1] and then pixel space
fn getFullPos(st: vec2<f32>) -> vec2<f32> {
  var uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var pos = getPos(st);
  pos /= pos.w;
  return pos.xy * uAspect;
}

fn getRotationMatrix(angle: f32) -> mat2x2<f32> {
  // then get sin and cos
  let s = sin(angle);
  let c = cos(angle);
  return mat2x2<f32>(
    vec2<f32>(c, -s),
    vec2<f32>(s, c)
  );
}

@vertex
fn vPathMain(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) stOffset: vec4<f32>,
  @location(1) xyWH: vec4<f32>,
  @location(2) tex: vec4<f32>,
  @location(3) stPaths12: vec4<f32>,
  @location(4) stPaths34: vec4<f32>,
  @location(5) collisionIndex: u32, // index to check in collisionResults
  @location(6) iconColor: vec4<f32>,
) -> VertexOutput {
  var output: VertexOutput;
  let uv = UVs[VertexIndex];
  let uIsIcon = glyph.isIcon == 1.;
  let st = stOffset.xy;
  let offset = stOffset.zw;
  let xy = xyWH.xy;
  let wh = xyWH.zw;
  let texXY = tex.xy;
  let texWH = tex.zw;
  output.isIcon = glyph.isIcon;

  // check if collision then we just return
  if (collisionResultsReadOnly[collisionIndex + glyph.sourceIndexOffset] != 0u) { return output; }

  // setup positions
  var stPos = getFullPos(st);
  var stPath1 = getFullPos(stPaths12.xy);
  var stPath2 = getFullPos(stPaths12.zw);
  var stPath3 = getFullPos(stPaths34.xy);
  var stPath4 = getFullPos(stPaths34.zw);

  var index = 0;
  var featureIndex = 0;

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
  if (attributes.isStroke == 1u) {
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

  // setup properties
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  let adjust = offset * view.devicePixelRatio;
  let paths = array<vec2<f32>, 4>(stPath1, stPath2, stPath3, stPath4);
  // get the offset and distance in pixel space
  var distance = xy.x * size;
  var offsetXY = adjust + vec2<f32>(0., (xy.y * size) - (size / (view.devicePixelRatio * 2)));
  // var offsetXY = adjust;
  // use the XY as a guide and follow the paths to our destination point
  var pPos = pathPosition(stPos, offsetXY, distance, paths);
  var posXY = pPos.xy;
  // setup a width height * quad at the correct angle and apply it to our position
  posXY += (wh * size) * (uv - 0.5) * getRotationMatrix(pPos.angle);
  // put it back into screen space
  posXY /= uAspect;
  // set texture read position
  var uTexSize = vec2<f32>(textureDimensions(glyphTexture));
  output.texcoord = (texXY / uTexSize) + (texWH / uTexSize * uv);

  output.Position = vec4(posXY, layer.depthPos, 1.0);

  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  let noAlpha = output.color.a < 0.01;
  let isIcon = output.isIcon == 1.;
  if (noAlpha && !isIcon) { discard; }
  let tex = textureSample(glyphTexture, glyphSampler, output.texcoord);
  // noAlpha for icons means it's a raw image, so we draw the pixels as they are
  if (noAlpha && isIcon) { return tex; }
  // otherwise we draw the MTSDF
  if (tex.a < 0.01) { discard; }
  var opacityS = smoothstep(output.buf - output.gamma, output.buf + output.gamma, median(tex.r, tex.g, tex.b));
  return opacityS * output.color;
  // return output.color;
}

/* TEST PASS */

const TestPos = array<vec2<f32>, 8>(
  vec2(0., 0.), vec2(1., 0.), // 1
  vec2(1., 0.), vec2(1., 1.), // 2
  vec2(1., 1.), vec2(0., 1.), // 3
  vec2(0., 1.), vec2(0., 0.) // 4
);

@vertex
fn vTest(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) st: vec2<f32>,
  @location(1) xy: vec2<f32>,
  @location(2) offsetXY: vec2<f32>,
  @location(3) pad: vec2<f32>,
  @location(4) wh: vec2<f32>,
  @location(5) collisionIndex: u32, // index to check in collisionResults
) -> TestOutput {
  var output: TestOutput;
  let uv = TestPos[VertexIndex];
  let uIsIcon = glyph.isIcon == 1.;

  // check if collision then we just return
  var color = vec4<f32>(1., 0., 0., 1.); // Collsion is red
  let collision = collisionResultsReadOnly[collisionIndex + glyph.sourceIndexOffset];
  if (collision == 0u) { // No collision is green
    color = vec4<f32>(0., 1., 0., 1.);
  } else if (collision == 2u) { // Out of bounds is blue
    color = vec4<f32>(0., 0., 1., 0.15);
  }

  // setup position
  var tmpPos = getPos(st);
  tmpPos /= tmpPos.w;
  var tmpPosXY = tmpPos.xy;

  var index = 0;
  var featureIndex = 0;

  // decode properties
  var tmpSize = decodeFeature(false, &index, &featureIndex)[0];
  if (uIsIcon) { tmpSize = decodeFeature(false, &index, &featureIndex)[0]; }
  var size = tmpSize * view.devicePixelRatio * 2.;

  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var padding = pad * view.devicePixelRatio * 2.;
  var offset = offsetXY * view.devicePixelRatio;
  var XY = ((xy * size) + offset - padding) / uAspect; // setup the xy positional change in pixels
  var WH = ((wh * size) + (padding * 2)) / uAspect;
  tmpPosXY += XY + (WH * uv);

  output.color = color;
  output.Position = vec4<f32>(tmpPosXY, layer.depthPos, 1.0);

  return output;
}

// given an index from [0, 32) return an angle in radians from [0, 2PI)
fn indexToAngle(index: f32) -> f32 {
  return index / 32. * 6.283185307179586;
}

fn pointOnCircle(center: vec2<f32>, radius: vec2<f32>, index: f32) -> vec2<f32> {
  let angle = indexToAngle(index);
  return center + vec2<f32>(cos(angle) * radius.x, sin(angle) * radius.y);
}

@vertex
fn vPathTest(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) st: vec2<f32>,
  @location(1) offset: vec2<f32>,
  @location(2) xy: vec2<f32>,
  @location(3) stPaths12: vec4<f32>,
  @location(4) stPaths34: vec4<f32>,
  @location(5) pad: f32,
  @location(6) collisionIndex: u32, // index to check in collisionResults
) -> TestOutput {
  var output: TestOutput;
  let uIsIcon = glyph.isIcon == 1.;

  // check if collision then we just return
  var color = vec4<f32>(1., 0., 0., 1.); // Collsion is red
  let collision = collisionResultsReadOnly[collisionIndex + glyph.sourceIndexOffset];
  if (collision == 0u) { // No collision is green
    color = vec4<f32>(0., 1., 0., 1.);
  } else if (collision == 2u) { // Out of bounds is blue
    color = vec4<f32>(0., 0., 1., 0.15);
  }

  var stPos = getFullPos(st);
  var stPath1 = getFullPos(stPaths12.xy);
  var stPath2 = getFullPos(stPaths12.zw);
  var stPath3 = getFullPos(stPaths34.xy);
  var stPath4 = getFullPos(stPaths34.zw);

  // decode properties
  var index = 0;
  var featureIndex = 0;
  var tmpSize = decodeFeature(false, &index, &featureIndex)[0];
  if (uIsIcon) { tmpSize = decodeFeature(false, &index, &featureIndex)[0]; }
  var size = tmpSize * view.devicePixelRatio * 2.;

  // setup properties
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var padding = pad * view.devicePixelRatio * 2.;
  let adjust = offset * view.devicePixelRatio;
  let paths = array<vec2<f32>, 4>(stPath1, stPath2, stPath3, stPath4);
  // get the offset and distance in pixel space
  var distance = xy.x * size;
  var offsetXY = adjust + vec2<f32>(0., xy.y * size);
  // use the XY as a guide and follow the paths to our destination point
  var pPos = pathPosition(stPos, offsetXY, distance, paths);
  var posXY = pPos.xy / uAspect;
  // var posXY = stPos / uAspect;
  var radius = ((size / 2.) + padding) / uAspect;
  var circleIndex = floor((f32(VertexIndex) + 1.) / 2.);

  output.color = color;
  output.Position = vec4<f32>(
    pointOnCircle(posXY, radius, circleIndex),
    layer.depthPos,
    1.0
  );

  return output;
}

@fragment
fn fTest(output: TestOutput) -> @location(0) vec4<f32> {
  if (output.color.a < 0.01) { discard; }
  return output.color;
}

/* COMPUTE FILTER PASSES */

const CIRCLE_CONDITION = -99999.;

fn overlap(a: BBox, b: BBox) -> bool {
  // check if a or b is bbox:
  let aIsCircle = a.top == CIRCLE_CONDITION;
  let bIsCircle = b.top == CIRCLE_CONDITION;
  if (aIsCircle && bIsCircle) {
    return circlesOverlap(
      Circle(a.index, a.left, a.bottom, a.right),
      Circle(b.index, b.left, b.bottom, b.right)
    );
  } else if (aIsCircle) {
    return boxCircleOverlap(b, Circle(a.index, a.left, a.bottom, a.right));
  } else if (bIsCircle) {
    return boxCircleOverlap(a, Circle(b.index, b.left, b.bottom, b.right));
  } else {
    return boxesOverlap(a, b);
  }
}

fn boxesOverlap(a: BBox, b: BBox) -> bool {
  if (
    a.left >= b.right ||
    b.left >= a.right ||
    a.top <= b.bottom ||
    b.top <= a.bottom
  ) { return false; }
  return true;
}

fn circlesOverlap(a: Circle, b: Circle) -> bool {
  let dx = a.x - b.x;
  let dy = a.y - b.y;
  let distance = sqrt(dx * dx + dy * dy);
  return distance < a.radius + b.radius;
}

fn boxCircleOverlap(a: BBox, b: Circle) -> bool {
  let dx = b.x - max(a.left, min(b.x, a.right));
  let dy = b.y - max(a.bottom, min(b.y, a.top));
  return (dx * dx + dy * dy) < b.radius * b.radius;
}

fn pointAngle(a: vec2<f32>, b: vec2<f32>, prev: f32) -> f32 {
  if (a.x == b.x && a.y == b.y) { return prev; }
  return atan2(b.y - a.y, b.x - a.x);
}

// NOTE: The data is prepped to ensure we can not go past the end of the paths array
fn pathPosition(
  st: vec2<f32>,
  offset: vec2<f32>,
  dist: f32,
  paths: array<vec2<f32>, 4>,
) -> PathPosition {
  var output: PathPosition;
  // setup circle variables
  let distanceToTravel = abs(dist);
  let sign = sign(dist);

  // we need to find xy by following the containers path
  var posXY = st + offset;
  var i = 0u;
  var distanceTraveled = 0.;
  var curAngle = 0.;
  while (distanceTraveled < distanceToTravel && i < 4u) {
    let pathPos = paths[i] + offset;
    let distance = abs(distance(posXY, pathPos));
    if (sign >= 0) {
      curAngle = pointAngle(posXY, pathPos, curAngle);
    } else {
      curAngle = pointAngle(pathPos, posXY, curAngle);
    }
    // first case: we haven't reached the distance yet
    if (distance + distanceTraveled < distanceToTravel) {
      posXY = pathPos;
    } else {
      // second case: we need to interpolate between the two points
      let t = (distanceToTravel - distanceTraveled) / distance;
      posXY = mix(posXY, pathPos, t);
      break;
    }
    // upgrade distance traveled and increment our index
    distanceTraveled += distance;
    // increment i
    i++;
  }

  output.xy = posXY;
  output.angle = curAngle;
  return output;
}

struct BoxCircleRes {
  size: f32,
  position: vec2<f32>,
};

fn prepBoxOrCircle(
  bboxIndex: u32,
  collideOffsetIndex: u32,
  st: vec2<f32>,
) -> BoxCircleRes { // return size and position data
  let collideIndex = collideOffsetIndex + glyph.sourceIndexOffset;
  let bbox = &bboxes[bboxIndex];
  var position = getPos(st);
  let zero = getZero();
  // adjust by w to match zero
  position /= position.w;
  // reset bbox
  (*bbox).index = collideIndex;
  (*bbox).left = 0.;
  (*bbox).bottom = 0.;
  (*bbox).right = 0.;
  (*bbox).top = 0.;
  // First check that we don't already have collisions
  var hasCollision: bool = false;
  var containerST = st;
  // Case 1: The point lies behind the sphere (if s2)
  if (tile.isS2 == 1. && position.z > zero.z) {
    hasCollision = true;
  } else if ( // Case 2: The point lies outside the bounds of the tile (if a child tile)
    containerST.x < bounds.left ||
    containerST.x > bounds.right ||
    containerST.y < bounds.bottom ||
    containerST.y > bounds.top
  ) {
    hasCollision = true;
  }

  if (hasCollision) {
    // update collision state
    atomicStore(&collisionResults[collideIndex], 2u);
    return BoxCircleRes(0., vec2<f32>(0., 0.));
  }
  // otherwise no collision
  atomicStore(&collisionResults[collideIndex], 0u);
  // figure out the size of the glyph
  var index = 0;
  var featureIndex = 0;
  // grab the size
  var size = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio * 2.;
  if (glyph.isIcon == 1.) { size = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio * 2.; }

  return BoxCircleRes(size, position.xy);
}

// PASS 1: Get positional data for each glyph and store in bboxes.
// Find early collisions (behind S2 sphere or outside tile bounds)
@compute @workgroup_size(64)
fn boxes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // prep
  if (global_id.x >= attributes.count) { return; }
  let offsetIndex = global_id.x + attributes.offset;
  let bboxIndex = offsetIndex + glyph.sourceIndexOffset;
  let container = containers[offsetIndex];
  // setup and get bbox/circle attributes
  let setup = prepBoxOrCircle(bboxIndex, container.index, container.st);
  let size = setup.size;
  let position = setup.position;
  // early return if no size (collision)
  if (size == 0.) { return; } // early return if no size (collision)
  // build bbox
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  var offset = container.offset * view.devicePixelRatio;
  var padding = container.pad * view.devicePixelRatio * 2.;
  var XY = ((container.xy * size) + offset - padding) / uAspect; // setup the xy positional change in pixels
  var WH = ((container.wh * size) + (padding * 2)) / uAspect;
  var bottomLeft = position.xy + XY;
  var topRight = bottomLeft + WH;
  // adjust back to pixel space 
  bottomLeft *= uAspect;
  topRight *= uAspect;
  // store
  let bbox = &bboxes[bboxIndex];
  (*bbox).left = bottomLeft.x;
  (*bbox).bottom = bottomLeft.y;
  (*bbox).right = topRight.x;
  (*bbox).top = topRight.y;
}
@compute @workgroup_size(64)
fn circles(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // prep
  if (global_id.x >= attributes.count) { return; }
  let offsetIndex = global_id.x + attributes.offset;
  let bboxIndex = offsetIndex + glyph.sourceIndexOffset;
  let containerPath = containerPaths[offsetIndex];
  // setup and get bbox/circle attributes
  let setup = prepBoxOrCircle(bboxIndex, containerPath.index, containerPath.st);
  let size = setup.size;
  let position = setup.position;
  // build circle position first
  let path = containerPath.path;
  var stPos = getFullPos(containerPath.st);
  var stPath1 = getFullPos(path[0]);
  var stPath2 = getFullPos(path[1]);
  var stPath3 = getFullPos(path[2]);
  var stPath4 = getFullPos(path[3]);
  let paths = array<vec2<f32>, 4>(stPath1, stPath2, stPath3, stPath4);
  let xy = containerPath.xy;
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  let padding = containerPath.pad * view.devicePixelRatio * 2.;
  let adjust = containerPath.offset * view.devicePixelRatio;
  let offsetXY = adjust + vec2<f32>(0., xy.y * size);
  var distance = xy.x * size;
  let radius = (size / 2.) + padding;
  let posXY = pathPosition(stPos, offsetXY, distance, paths).xy;
  // early return if no size (collision)
  if (size == 0.) { return; } // early return if no size (collision)
  // store
  let bbox = &bboxes[bboxIndex];
  (*bbox).left = posXY.x; // x
  (*bbox).bottom = posXY.y; // y
  (*bbox).right = radius; // radius
  (*bbox).top = CIRCLE_CONDITION;
}

// PASS 2: Check for collisions between computed bboxes
@compute @workgroup_size(64)
fn test(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let bboxIndex = global_id.x;
  if (bboxIndex >= arrayLength(&bboxes)) { return; }
  let box = bboxes[bboxIndex];
  let collideIndex = box.index;

  if (box.left == 0. && box.right == 0.) { return; }

  // Test for collisions
  // Case 1: Bbox has already "collided" with either the S2 sphere or tile bounds
  if (atomicLoad(&collisionResults[collideIndex]) != 0u) {
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
        otherResultIndex != collideIndex &&
        overlap(testBox, box) &&
        atomicLoad(&collisionResults[otherResultIndex]) == 0u
      ) {
        // update collision state
        atomicStore(&collisionResults[collideIndex], 1u);
        break;
      }
      i++;
    }
  }
}

@compute @workgroup_size(64)
fn interactive(@builtin(global_invocation_id) global_id: vec3<u32>) {
  if (global_id.x >= attributes.count) { return; }
  let containerIndex = global_id.x + attributes.offset;
  // iterate through each GlyphContainer and see if the mouse is inside the bbox
  let bboxIndex = containerIndex + glyph.sourceIndexOffset;
  let box = bboxes[bboxIndex];
  
  if (collisionResultsReadOnly[box.index] != 0u) { return; }

  // check if mouse is inside box
  let mousePos = vec2<f32>(view.mouseX * view.aspectX, view.mouseY * view.aspectY);
  if (box.top == CIRCLE_CONDITION) {
    let container = containerPaths[containerIndex];
    // check if mouse is inside circle
    // (box.left -> circle.x; box.bottom -> circle.y; box.right -> circle.radius)
    if (length(mousePos - vec2<f32>(box.left, box.bottom)) <= box.right) {
      results[atomicAdd(&resultIndex, 1u)] = container.id;
    }
  } else if (
    mousePos.x >= box.left &&
    mousePos.x <= box.right &&
    mousePos.y >= box.bottom &&
    mousePos.y <= box.top
  ) {
    let container = containers[containerIndex];
    results[atomicAdd(&resultIndex, 1u)] = container.id;
  }
}

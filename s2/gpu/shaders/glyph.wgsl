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

// TODO: Store ID in the collision result array??? That way we can check the end of the ID
// TODO - IDEA: One more compute shader that runs through each GlyphContainer and checks the collisionResults
// TODO - IDEA: If the collisionResults is 0 or 1, then we update the last 8 bits +- a change value
// to see if it's a shared container (and how many containers it shares with for opacity change)
struct GlyphContainer {
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  xy: vec2<f32>, // xy starting position of the glyph box relative to the final computed position
  offset: vec2<f32>, // offset from the xy position
  pad: vec2<f32>, // padding around the container
  wh: vec2<f32>, // width & height of the container
  index: u32, // index in the collision result array without offset (needed because some Containers share indexes)
  id: u32, // identifier - the last 8 bits explain how many containers it shares with
};

struct GlyphContainerPath {
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  path: array<vec2<f32>, 3>, // path of st points from the starting position st
  distance: f32, // distance in glyphs from the starting position st. 0.0 is the center glyph assuming odd number of glyphs
  pad: f32, // padding around the container
  index: u32, // index in the collision result array without offset (needed because some Containers share indexes)
  id: u32, // identifier - the last 8 bits explain how many containers it shares with
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
  @location(1) adjustXY: vec2<f32>,
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
  var adjust = adjustXY * view.devicePixelRatio;
  var XY = (adjust + (xy * size)) / uAspect; // setup the xy positional change in pixels
  var quad = (wh * size) / uAspect * uv;
  posXY += XY + quad;
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  var uTexSize = vec2<f32>(textureDimensions(glyphTexture));
  output.texcoord = (texXY / uTexSize) + (texWH / uTexSize * uv);
  // output.texcoord = uv;

  output.Position = vec4(posXY, layer.depthPos, 1.0);

  return output;
}

@vertex
fn vCircleMain(
  @builtin(vertex_index) VertexIndex: u32,
  @location(0) st: vec2<f32>,
  @location(1) stPath1: vec2<f32>,
  @location(2) stPath2: vec2<f32>,
  @location(3) stPath3: vec2<f32>,
  @location(4) distance: f32,
  @location(5) texXY: vec2<f32>,
  @location(6) texWH: vec2<f32>,
  @location(7) collisionIndex: u32, // index to check in collisionResults
  @location(8) iconColor: vec4<f32>,
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
  var tmpPosXY = tmpPos.xy;

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

  // build circle
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  let radius = size * view.devicePixelRatio * 2. / uAspect; // * 2 pixel ratio and then radius is size / 2
  var posXY = pathPosition(distance, array<vec2<f32>, 3>(stPath1, stPath2, stPath3), st, size);
  // migrate glyph by half the radius
  posXY += radius;
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  var uTexSize = vec2<f32>(textureDimensions(glyphTexture));
  output.texcoord = (texXY / uTexSize) + (texWH / uTexSize * uv);
  // output.texcoord = uv;

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

fn pathPosition(
  distance: f32,
  paths: array<vec2<f32>, 3>,
  startPosition: vec2<f32>,
  size: f32,
) -> vec2<f32> {
// setup circle variables
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  // container distance is in glyph units, so we need to multiply by current glyph size
  // and convert to pixels.
  // combined glyph units are defined by the number of glyphs traveled:
  // let sum = (glyph1.advanceWidth + glyph1.kerning) + (glyph2.advanceWidth + glyph2.kerning) + ...
  var distanceToTravel = distance * size;

  // we need to find xy by following the containers path
  var posXY = startPosition;
  var i = 0u;
  var distanceTraveled = 0.;
  while (distanceTraveled < distanceToTravel) {
    let path = paths[i];
    var pathPos = getPos(path.xy);
    pathPos /= pathPos.w;
    let distance = length(uAspect * pathPos.xy);
    // first case: we haven't reached the distance yet
    if (distance + distanceTraveled < distanceToTravel) {
      posXY = pathPos.xy;
    } else {
      // second case: we are at the last point and we need to travel past it
      // third case: otherwise we need to interpolate between the two points
      let t = (distanceToTravel - distanceTraveled) / distance;
      posXY = mix(posXY, pathPos.xy, t);
      break;
    }
    // upgrade distance traveled and increment our index
    distanceTraveled += distance;
    // increment i
    i++;
  }
  return posXY;
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
  // early return if no size (collision)
  if (size == 0.) { return; } // early return if no size (collision)
  // build circle
  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  let padding = containerPath.pad * view.devicePixelRatio * 2.;
  let radius = (size / 2.) + padding;
  let posXY = pathPosition(containerPath.distance, containerPath.path, position.xy, size) * uAspect;
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
    // TODO: overdraw needs to be stored inside the bbox
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
  let container = containers[containerIndex];
  let bboxIndex = containerIndex + glyph.sourceIndexOffset;
  let box = bboxes[bboxIndex];
  
  if (collisionResultsReadOnly[box.index] != 0u) { return; }

  // check if mouse is inside box
  let mousePos = vec2<f32>(view.mouseX * view.aspectX, view.mouseY * view.aspectY);
  if (box.top == CIRCLE_CONDITION) {
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
    results[atomicAdd(&resultIndex, 1u)] = container.id;
  }
}

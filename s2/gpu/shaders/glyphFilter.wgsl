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

struct GlyphUniforms {
  indexOffset: f32, // where to start in the collisionResults array
  deltaT: f32, // time since last frame
  deltaDuration: f32, // duration of an animation cycle
};

struct Bounds {
  left: f32,
  bottom: f32,
  right: f32,
  top: f32,
};

struct GlyphContainer {
  id: u32, // identifier
  index: u32, // index in the collision result array (needed because some Containers share indexes)
  st: vec2<f32>, // s & t position relative to the tile's 0-1 bounds
  xy: vec2<f32>, // xy starting position of the glyph box relative to the final computed position
  pad: vec2<f32>, // padding around the container
  wh: vec2<f32>, // width & height of the container
};

struct BBox {
  index: u32, // index in the collision result array (needed because some Containers share indexes)
  left: f32,
  bottom: f32,
  right: f32,
  top: f32,
};

// Collisions can be with the S2 sphere, tile bounds, or other containers.
struct CollisionResult {
  collided: u32, // 1 for collision, 0 for no collision.
  opacity: f32, // Opacity value, ranges between 0.0 and 1.0
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
// ** GLYPH DATA **
@binding(0) @group(2) var<uniform> bounds: Bounds;
@binding(1) @group(2) var<uniform> uniforms: GlyphUniforms;
@binding(2) @group(2) var<uniform> state: GlyphState;
// containers are mapped to bboxes.
// indexes of containers and bboxes are the same and map to the location in collisionResults
@binding(3) @group(2) var<storage, read> containers: array<GlyphContainer>;
@binding(4) @group(2) var<storage, read_write> bboxes: array<BBox>;
@binding(5) @group(2) var<storage, read_write> collisionResults: array<CollisionResult>;

fn stToUV (s: f32) -> f32 {
  var mutS = s;
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (mutS >= 0.5) { return (1. / 3.) * (4. * mutS * mutS - 1.); }
  else { return (1. / 3.) * (1. - 4. * (1. - mutS) * (1. - mutS)); }
}

fn stToXYZ (st: vec2<f32>) -> vec4<f32> { // x -> s, y -> t
  var mutST = st;
  mutST /= 8192.;
  let face = tile.face;
  // prep xyz
  var xyz = vec3<f32>();
  // convert to uv
  let uv = vec2<f32>(
    stToUV(tile.deltaS * mutST.x + tile.sLow), // deltaS * sPos + sLow
    stToUV(tile.deltaT * mutST.y + tile.tLow) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (face == 0.) { xyz = vec3(uv.x, uv.y, 1.); }
  else if (face == 1.) { xyz = vec3(1., uv.y, -uv.x); }
  else if (face == 2.) { xyz = vec3(-uv.y, 1., -uv.x); }
  else if (face == 3.) { xyz = vec3(-uv.y, -uv.x, -1.); }
  else if (face == 4.) { xyz = vec3(-1., -uv.x, uv.y); }
  else { xyz = vec3(uv.x, -1., uv.y); }
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

fn getPosLocal (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  mutPos /= 8192.;
  if (tile.isS2 == 0.) {
    return matrix * vec4(mutPos, 0, 1);
  }
  // find position following s
  var deltaBottom = tilePos.bottomRight - tilePos.bottomLeft;
  var deltaTop = tilePos.topRight - tilePos.topLeft;
  var bottomPosS = tilePos.bottomLeft + deltaBottom * mutPos.x;
  var topPosS = tilePos.topLeft + deltaTop * mutPos.x;
  // using s positions, find t
  var deltaS = topPosS - bottomPosS;
  var res = bottomPosS + deltaS * mutPos.y;
  return vec4(res, 0., 1.);
}

fn getPos (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  if (tile.isS2 == 0.) {
    mutPos /= 8192.;
    return matrix * vec4<f32>(mutPos, 0., 1.);
  } else if (view.zoom < 12.) {
    return matrix * stToXYZ(mutPos);
  } else {
    return getPosLocal(mutPos);
  }
}

fn getZero () -> vec4<f32> {
  if (view.zoom < 12.) {
    return matrix * vec4<f32>(0., 0., 0., 1.);
  } else { return vec4<f32>(0., 0., 1., 1.); }
}

fn boxesOverlap(a: BBox, b: BBox) -> bool {
  if (a.left >= b.right || b.left >= a.right) return false;
  if (a.top <= b.bottom || b.top <= a.bottom) return false;
  return true;
}

// PASS 1: reset collision state to 0 for all results
@compute @workgroup_size(64)
fn resetCollisions(@builtin(global_invocation_id) global_id: vec3<u32>) {
  // reset collision state
  &collisionResults[global_id.x].collided = 0u;
}

// PASS 2: Get positional data for each glyph and store in bboxes
@compute @workgroup_size(64)
fn buildBBoxes(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let container = containers[global_id.x];
  let bbox = &bboxes[global_id.x];
  let position = getPos(container.st);
  let thisZero = getZero();
  // adjust by w to match zero
  position /= position.w;

  // set bbox index
  *bbox.index = container.index;

  // First check that we don't already have collisions
  var hasCollision: bool = false;
  // Case 1: The point lies behind the sphere (if s2)
  if (tile.isS2 == 1. && outPos.z > zero.z) {
    hasCollision = true;
  } else if ( // Case 2: The point lies outside the bounds of the tile (if a child tile)
    position.x < bounds.left ||
    position.x > bounds.right ||
    position.y < bounds.bottom ||
    position.y > bounds.top
  ) {
    hasCollision = true;
  }

  if (hasCollision) {
    // update collision state
    &collisionResults[container.index].collided = 1u;
    bbox.left = 0.;
    bbox.bottom = 0.;
    bbox.right = 0.;
    bbox.top = 0.;
    return;
  }

  // figure out the size of the glyph
  var index = 0u;
  var featureIndex = 0u;
  // grab the size
  var size = decodeFeature(false, &index, &featureIndex)[0] * view.devicePixelRatio;

  let uAspect = vec2<f32>(view.aspectX, view.aspectY);
  // create width & height, adding padding to the total size
  var wh = (container.wh * size + (container.pad * 2.)) / uAspect;
  // find the bottom left position
  var bottomLeft = position.xy + (container.xy * size / uAspect);
  // find the top right position
  var topRight = bottomLeft + wh;
  // store
  bbox.left = bottomLeft.x;
  bbox.bottom = bottomLeft.y;
  bbox.right = topRight.x;
  bbox.top = topRight.y;
}

// PASS 3: Check for collisions between computed bboxes
@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
  let this = bboxes[global_id.x];
  let thisIndex = container.index;

  // First check that we don't already have collisions
  var hasCollision: bool = false;
  // Case 1: Bbox has already "collided"
  if (atomicLoad(&collisionResults[thisIndex].collided) == 1u) {
    hasCollision = true;
  } else { // Case 2: Check against other BBoxes before this one
    var i = 0u;
    loop {
      if (i >= bboxes.length || i >= thisIndex) { break; }
      let other = bboxes[i];
      if (other.index == thisIndex) { i++; continue; } // don't check against self
      // check if collision, then check the lower indexed glyph isn't already collided with something else
      if (boxesOverlap(other, this) && atomicLoad(&collisionResults[other.index].collided) != 1u) {
        hasCollision = true;
        // update collision state
        collisionResults[thisIndex].collided = 1u;
        break;
      }
      i++;
    }
  }

  // prep an opacity change using deltaT and deltaDuration
  let opacityChange = state.deltaT / state.deltaDuration;
  if (hasCollision) {
    // Decrease opacity, but not below 0.0
    &collisionResults[thisIndex].opacity = max(&collisionResults[thisIndex].opacity - opacityChange, 0.0);
  } else {
    // Increase opacity, but not above 1.0
    &collisionResults[thisIndex].opacity = min(&collisionResults[thisIndex].opacity + opacityChange, 1.0);
  }
}

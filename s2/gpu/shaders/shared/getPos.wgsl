struct PositionUniforms {
  face: i32,
  zoom: i32,
  sLow: f32,
  tLow: f32,
  deltaS: f32,
  deltaT: f32,
  uBottom: vec4<f32>, // [bottomLeft-X, bottomLeft-Y, bottomRight-X, bottomRight-Y]
  uTop: vec4<f32>, // [topLeft-X, topLeft-Y, topRight-X, topRight-Y]
  uMatrix: mat4x4<f32>,
  uIsS2: bool,
}

@binding(1) @group(2) var<uniform> posUniforms : PositionUniforms;

fn stToUV (s: f32) -> f32 {
  var mutS = s;
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (mutS >= 0.5) { return (1. / 3.) * (4. * mutS * mutS - 1.); }
  else { return (1. / 3.) * (1. - 4. * (1. - mutS) * (1. - mutS)); }
}

fn stToXYZ (st: vec2<f32>) -> vec4<f32> { // x -> s, y -> t
  var mutST = st;
  mutST /= 8192.;
  var face = posUniforms.tileFace;
  // prep xyz
  var xyz = vec3<f32>();
  // convert to uv
  var uv = vec2<f32>(
    stToUV(posUniforms.deltaS * mutST.x + posUniforms.sLow), // deltaS * sPos + sLow
    stToUV(posUniforms.deltaT * mutST.y + posUniforms.tLow) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (face == 0) { xyz = vec3(uv.x, uv.y, 1.); }
  else if (face == 1) { xyz = vec3(1., uv.y, -uv.x); }
  else if (face == 2) { xyz = vec3(-uv.y, 1., -uv.x); }
  else if (face == 3) { xyz = vec3(-uv.y, -uv.x, -1.); }
  else if (face == 4) { xyz = vec3(-1., -uv.x, uv.y); }
  else { xyz = vec3(uv.x, -1., uv.y); }
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

fn getPosLocal (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  mutPos /= 8192.;
  if (posUniforms.uIsS2 == 0u) {
    return posUniforms.uMatrix * vec4(mutPos, 0, 1);
  }
  // find position following s
  var deltaBottom = posUniforms.uBottom.zw - posUniforms.uBottom.xy;
  var deltaTop = posUniforms.uTop.zw - posUniforms.uTop.xy;
  var bottomPosS = posUniforms.uBottom.xy + deltaBottom * mutPos.x;
  var topPosS = posUniforms.uTop.xy + deltaTop * mutPos.x;
  // using s positions, find t
  var deltaS = topPosS - bottomPosS;
  var res = bottomPosS + deltaS * mutPos.y;
  return vec4(res, 0., 1.);
}

fn getPos (pos: vec2<f32>) -> vec4<f32> {
  var mutPos = pos;
  if (posUniforms.uIsS2 == 0u) {
    mutPos /= 8192.;
    return posUniforms.uMatrix * vec4<f32>(mutPos, 0., 1.);
  } else if (posUniforms.zoom < 12.) {
    return posUniforms.uMatrix * stToXYZ(mutPos);
  } else {
    return getPosLocal(mutPos);
  }
}

fn getZero () -> vec4<f32> {
  if (view.zoom < 12.) {
    return matrix * vec4<f32>(0., 0., 0., 1.);
  } else { return vec4<f32>(0., 0., 1., 1.); }
}
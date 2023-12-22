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
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (s >= 0.5) { return (1. / 3.) * (4. * s * s - 1.); }
  else { return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s)); }
}

fn stToXYZ (st: vec2<f32>) -> vec4<f32> { // x -> s, y -> t
  // prep xyz
  var xyz = vec3<f32>();
  // convert to uv
  let uv = vec2<f32>(
    stToUV(tile.deltaS * st.x + tile.sLow), // deltaS * sPos + sLow
    stToUV(tile.deltaT * st.y + tile.tLow) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (tile.face == 0.) { xyz = vec3(uv.x, uv.y, 1.); }
  else if (tile.face == 1.) { xyz = vec3(1., uv.y, -uv.x); }
  else if (tile.face == 2.) { xyz = vec3(-uv.y, 1., -uv.x); }
  else if (tile.face == 3.) { xyz = vec3(-uv.y, -uv.x, -1.); }
  else if (tile.face == 4.) { xyz = vec3(-1., -uv.x, uv.y); }
  else { xyz = vec3(uv.x, -1., uv.y); }
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

fn getPosLocal (pos: vec2<f32>) -> vec4<f32> {
  // find position following s
  var deltaBottom = tilePos.bottomRight - tilePos.bottomLeft;
  var deltaTop = tilePos.topRight - tilePos.topLeft;
  var bottomPosS = tilePos.bottomLeft + deltaBottom * pos.x;
  var topPosS = tilePos.topLeft + deltaTop * pos.x;
  // using s positions, find t
  var deltaS = topPosS - bottomPosS;
  var res = bottomPosS + deltaS * pos.y;
  return vec4(res, 0., 1.);
}

fn getPos (pos: vec2<f32>) -> vec4<f32> {
  if (tile.isS2 == 0. || view.zoom >= 12.) {
    return getPosLocal(pos);
  } else {
    return matrix * stToXYZ(pos);
  }
}

fn getZero () -> vec4<f32> {
  if (tile.isS2 == 0. || view.zoom >= 12.) {
    return vec4<f32>(0., 0., 1., 1.);
  } else {
    return matrix * vec4<f32>(0., 0., 0., 1.);
  }
}

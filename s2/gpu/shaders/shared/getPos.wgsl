struct PositionUniforms {
  uFaceST: array<f32, 6>, // [face, zoom, sLow, deltaS, tLow, deltaT]
  uBottom: vec4, // [bottomLeft-X, bottomLeft-Y, bottomRight-X, bottomRight-Y]
  uTop: vec4, // [topLeft-X, topLeft-Y, topRight-X, topRight-Y]
  uMatrix: mat4x4<f32>,
  uIsS2: bool,
}

@binding(1) @group(2) var<uniform> posUniforms : PositionUniforms;

fn st_to_uv (s: f32) -> f32 {
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (s >= 0.5) return (1. / 3.) * (4. * s * s - 1.);
  else return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s));
}

fn st_to_xyz (st: vec2) -> vec4 { // x -> s, y -> t
  st /= 8192.;
  int face = int(posUniforms.uFaceST[0]);
  // prep xyz
  vec3 xyz;
  // convert to uv
  vec2 uv = vec2(
    st_to_uv(posUniforms.uFaceST[2] * st.x + posUniforms.uFaceST[3]), // deltaS * sPos + sLow
    st_to_uv(posUniforms.uFaceST[4] * st.y + posUniforms.uFaceST[5]) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (face == 0) xyz = vec3(uv.x, uv.y, 1.);
  else if (face == 1) xyz = vec3(1., uv.y, -uv.x);
  else if (face == 2) xyz = vec3(-uv.y, 1., -uv.x);
  else if (face == 3) xyz = vec3(-uv.y, -uv.x, -1.);
  else if (face == 4) xyz = vec3(-1., -uv.x, uv.y);
  else xyz = vec3(uv.x, -1., uv.y);
  // normalize data
  xyz = normalize(xyz) * 6371.0088;

  return vec4(xyz, 1.);
}

vec4 getPosLocal (in vec2 pos) {
  pos /= 8192.;
  if (!posUniforms.uIsS2) {
    return posUniforms.uMatrix * vec4(pos, 0, 1);
  }
  // find position following s
  vec2 deltaBottom = posUniforms.uBottom.zw - posUniforms.uBottom.xy;
  vec2 deltaTop = posUniforms.uTop.zw - posUniforms.uTop.xy;
  vec2 bottomPosS = posUniforms.uBottom.xy + deltaBottom * pos.x;
  vec2 topPosS = posUniforms.uTop.xy + deltaTop * pos.x;
  // using s positions, find t
  vec2 deltaS = topPosS - bottomPosS;
  vec2 res = bottomPosS + deltaS * pos.y;
  return vec4(res, 0., 1.);
}

vec4 getPos (in vec2 pos) {
  if (!posUniforms.uIsS2) {
    pos /= 8192.;
    return posUniforms.uMatrix * vec4(pos, 0, 1);
  } else if (posUniforms.uFaceST[1] < 12.) {
    return posUniforms.uMatrix * STtoXYZ(pos);
  } else {
    return getPosLocal(pos);
  }
}

vec4 getZero () {
  if (posUniforms.uFaceST[1] < 12.) {
    return posUniforms.uMatrix * vec4(0., 0., 0., 1.);
  } else { return vec4(0., 0., 1., 1.); }
}

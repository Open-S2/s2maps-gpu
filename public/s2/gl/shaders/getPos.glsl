uniform float uFaceST[6]; // [face, zoom, sLow, deltaS, tLow, deltaT]
uniform vec4 uBottom; // [bottomLeft-X, bottomLeft-Y, bottomRight-X, bottomRight-Y]
uniform vec4 uTop; // [topLeft-X, topLeft-Y, topRight-X, topRight-Y]
uniform mat4 uMatrix;

float STtoUV (float s) {
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (s >= 0.5) return (1. / 3.) * (4. * s * s - 1.);
  else return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s));
}

vec4 STtoXYZ (in vec2 st) { // x -> s, y -> t
  st /= 8192.;
  int face = int(uFaceST[0]);
  // prep xyz
  vec3 xyz;
  // convert to uv
  vec2 uv = vec2(
    STtoUV(uFaceST[2] * st.x + uFaceST[3]), // deltaS * sPos + sLow
    STtoUV(uFaceST[4] * st.y + uFaceST[5]) // deltaT * tPos + tLow
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
  // xyz *= 6371008.8;
  // xyz.xz *= 6378137.;
  // xyz.y *= 6356752.3;

  return vec4(xyz, 1.);
}

vec4 getPosLocal (in vec2 pos) {
  pos /= 8192.;
  // find position following s
  vec2 deltaBottom = uBottom.zw - uBottom.xy;
  vec2 deltaTop = uTop.zw - uTop.xy;
  vec2 bottomPosS = uBottom.xy + deltaBottom * pos.x;
  vec2 topPosS = uTop.xy + deltaTop * pos.x;
  // using s positions, find t
  vec2 deltaS = topPosS - bottomPosS;
  vec2 res = bottomPosS + deltaS * pos.y;
  return vec4(res, 0., 1.);
}

vec4 getPos (in vec2 pos) {
  if (uFaceST[1] < 12.) {
    return uMatrix * STtoXYZ(pos);
  } else {
    return getPosLocal(pos);
  }
  // return uMatrix * STtoXYZ(pos);
}

vec4 getZero () {
  if (uFaceST[1] < 12.) {
    return uMatrix * vec4(0., 0., 0., 1.);
  } else { return vec4(0., 0., 1., 1.); }
}

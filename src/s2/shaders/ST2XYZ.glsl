uniform float uFaceST[6]; // [face, zoom, sLow, deltaS, tLow, deltaT]

float STtoUV (float s) {
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  if (s >= 0.5) return (1. / 3.) * (4. * s * s - 1.);
  else return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s));
}

vec4 STtoXYZ (in vec2 st) { // x -> s, y -> t
  int face = int(uFaceST[0]);
  // prep xyz
  vec3 xyz;
  // convert to uv
  vec2 uv = vec2(
    STtoUV(uFaceST[2] * st.x + uFaceST[3]), // deltaS * sPos + sLow
    STtoUV(uFaceST[4] * st.y + uFaceST[5]) // deltaT * tPos + tLow
  ); // x -> u, y -> v
  // convert uv to xyz according to face
  if (face == 0) xyz = vec3(uv.x, uv.y, 1);
  else if (face == 1) xyz = vec3(1, uv.y, -uv.x);
  else if (face == 2) xyz = vec3(-uv.y, 1, -uv.x);
  else if (face == 3) xyz = vec3(-uv.y, -uv.x, -1);
  else if (face == 4) xyz = vec3(-1, -uv.x, uv.y);
  else xyz = vec3(uv.x, -1, uv.y);
  // normalize data
  xyz = normalize(xyz) * 1000.;
  // return
  return vec4(xyz, 1);
}

const float EXTENT = 4096.;

uniform int uFXY[3]; // [face, x, y]

float STtoUV (float s) {
  // compressed VTs are extended, so we must squeeze them back to [0,1]
  s /= EXTENT;
  if (s >= 0.5) return (1. / 3.) * (4. * s * s - 1.);
  else return (1. / 3.) * (1. - 4. * (1. - s) * (1. - s));
}

vec4 ST2XYZ (in vec2 st) { // x -> s, y -> t
  // prep xyz
  vec3 xyz;
  // convert to uv
  vec2 uv = vec2(STtoUV(st.x), STtoUV(st.y)); // x -> u, y -> v
  // convert to xyz according to face
  if (uFXY[0] == 0) xyz = vec3(uv.x, uv.y, 1);
  else if (uFXY[0] == 1) xyz = vec3(1, uv.y, -uv.x);
  else if (uFXY[0] == 2) xyz = vec3(-uv.y, 1, -uv.x);
  else if (uFXY[0] == 3) xyz = vec3(-uv.y, -uv.x, -1);
  else if (uFXY[0] == 4) xyz = vec3(-1, -uv.x, uv.y);
  else xyz = vec3(uv.x, -1, uv.y);
  // normalize data
  xyz = normalize(xyz);
  // return
  return vec4(xyz, 1);
}

#version 300 es
precision mediump float;

in vec3 aPos;
// out vec4 color;
uniform mat4 uMatrix;

// uniform TileState {
//   mat4 uMatrix;
// };
//
// uniform InputState {
//   float inputs[16]; // [zoom, lat, lon, angle, pitch, ...FeatureStates]
//   float encodings[256];
//   float featureCode[64];
// };

void main () {
  // Multiply the position by the matrix.
  gl_Position = uMatrix * vec4(aPos, 1);
}

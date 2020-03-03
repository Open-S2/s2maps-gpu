#version 300 es
precision mediump float;
// https://stackoverflow.com/questions/17638800/storing-two-float-values-in-a-single-float-variable

#define DIVISOR 0.0009765625 // this has to do with a tile's precision
// #define PRECISION 4096.

layout (location = 1) in vec2 aPos;
layout (location = 2) in vec2 aNormal;
// layout (location = 3) in float aLengthSoFar;
layout (location = 8) in float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

@import ./decodeFeature;
@import ./ST2XYZ;

// out float lengthSoFar;
out vec4 color;

// float map (float value, float min1, float max1, float min2, float max2) {
//   return min2 + (value - min1) * (max2 - min2) / (max1 - min1);
// }

// vec2 unpack (float pNorm) {
//   float denom = PRECISION - 1.;
//   return vec2(
//     floor(pNorm / PRECISION) / denom,
//     mod(pNorm, PRECISION) / denom
//   );
// }

void main () {
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0];
  float scale = 1. - mod(uInputs[0], 1.);
  scale = 0.5 + (scale) * (1. - 0.5); // map the scale from 0->1 to 0.5->1
  width = width * DIVISOR * scale;
  // multiply width by pos and normal
  // vec2 normal = unpack(aNormal);
  vec2 newPos = vec2(aPos.x + (aNormal.x * width), aPos.y + (aNormal.y * width));
  // send off the length so far
  // lengthSoFar = aLengthSoFar;
  // set position
  gl_Position = uMatrix * STtoXYZ(newPos);
}

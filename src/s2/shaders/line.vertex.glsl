#version 300 es
precision mediump float;

layout (location = 3) in vec3 aPosHigh;
layout (location = 4) in vec3 aPosLow;
layout (location = 2) in uint index;
layout (location = 5) in vec2 aVector;

uniform mat4 uMatrix;
uniform vec3 uEyePosHigh;
uniform vec3 uEyePosLow;
uniform vec2 uResolution;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

@import ./decodeFeature;
@import ./rteDSFun90;

out vec4 color;

vec3 decodeVector (vec2 enc) {
  vec2 fenc = enc * 4.0 - 2.0;
  float f = dot(fenc, fenc);
  float g = sqrt(1.0 - f / 4.0);

  vec3 n;
  n.xy = fenc * g;
  n.z = 1.0 - f / 2.0;
  return n;
}

void addWidth (inout vec4 normal, in float width) {
  normal.x = width * uResolution.x;
  normal.y = width * uResolution.y;
}

void main () {
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = 0;
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0];
  // GPU-RTE DSFUN90
  vec3 pos = RTE(aPosHigh, aPosLow);
  // build out the vector
  vec3 vector = decodeVector(aVector);
  // create a new pos using the vector and a 1unit distance
  vec4 vectorPoint = uMatrix * vec4(pos + vector, 1);
  // get the position of the starting point:
  vec4 startingPos = uMatrix * vec4(pos, 1);
  // get the normal from the startingPos and vectorPoint
  vec4 normal = normalize(startingPos - vectorPoint);
  // build out the normal using the width and resolution of the canvas
  addWidth(normal, width);
  // set position
  gl_Position = startingPos + normal;
}

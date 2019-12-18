#version 300 es
precision mediump float;

layout (location = 0) in vec3 aPosHigh;
layout (location = 1) in vec3 aPosLow;
// layout (location = 2) in uint index;

uniform mat4 uMatrix;
uniform vec3 uEyePosHigh;
uniform vec3 uEyePosLow;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[64];

@import ./decodeFeature;
@import ./rteDSFun90;

out vec4 color;

void main () {
  // decode color
  color = decodeFeature(true, 0, 0);
  // GPU-RTE DSFUN90
  vec3 pos = RTE();
  // set position
  gl_Position = uMatrix * vec4(pos, 1);
}

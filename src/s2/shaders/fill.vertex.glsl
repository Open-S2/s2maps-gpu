#version 300 es
precision mediump float;

#define EXTENT 4096.

layout (location = 0) in vec2 aPos;
layout (location = 5) in float aIndex;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

@import ./decodeFeature;

out vec4 color;

vec2 decodePosition (in vec2 uv) {
  return vec2(
    (uv.x / EXTENT) * 2. - 1.,
    (uv.y / EXTENT) * 2. - 1.
  );
}

void main () {
  // prep layer index and feature index positions
  int index = int(aIndex);
  int featureIndex = 0;
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // convert points to -1 to +1 xy space
  vec2 pos = decodePosition(aPos);
  // set position
  gl_Position = vec4(pos, 0, 1);
}

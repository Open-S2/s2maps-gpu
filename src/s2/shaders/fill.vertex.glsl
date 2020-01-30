#version 300 es
precision highp float;

#define EXTENT 4096.

layout (location = 0) in vec2 aPos;
layout (location = 5) in float aIndex;

uniform mat4 uMatrix;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

@import ./decodeFeature;
@import ./ST2XYZ;

out vec4 color;

void main () {
  // prep layer index and feature index positions
  int index = int(aIndex);
  int featureIndex = 0;
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // convert xy extent space to xyz
  vec3 pos = ST2XYZ(aPos);
  // set position
  gl_Position = uMatrix * vec4(pos, 0, 1);
}

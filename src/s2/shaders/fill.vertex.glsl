#version 300 es
precision highp float;

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
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // set position
  gl_Position = uMatrix * ST2XYZ(aPos);
}

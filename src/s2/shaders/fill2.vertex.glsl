#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 6) in float aRadius;
layout (location = 7) in float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature2;
#include ./ST2XYZ;

out vec4 color;
out vec2 vTexcoord;

void main () {
  // set position
  // prep xyz
  vec2 pos = aPos / 4096.;
  vTexcoord = pos;
  vec4 xyz = STtoXYZ(pos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 200.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;

  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
}

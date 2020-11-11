#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 6) in float aRadius;
layout (location = 7) in float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

#include ./decodeFeature2;
#include ./ST2XYZ;

out vec4 color;

void main () {
  // set position
  // prep xyz
  vec4 xyz = STtoXYZ(aPos / 8192.);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 500.);
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
  color.rgb *= color.a;
}

#version 300 es
precision mediump float;

layout (location = 0) in vec2 aPos;
layout (location = 6) in float aRadius;

uniform mat4 uMatrix;
uniform bool u3D;

#include ./ST2XYZ;

out vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 4096.;
  vTexcoord = pos;
  // prep xyz
  vec4 xyz = STtoXYZ(pos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 150.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;
}

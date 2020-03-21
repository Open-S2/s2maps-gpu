#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 6) in float aRadius;

uniform mat4 uMatrix;
uniform bool u3D;

@import ./ST2XYZ;

out vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vTexcoord = aPos;
  // prep xyz
  vec4 xyz = STtoXYZ(aPos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 200.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;
}

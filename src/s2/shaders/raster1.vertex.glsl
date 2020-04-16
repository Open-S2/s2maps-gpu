precision highp float;

attribute vec2 aPos;
attribute float aRadius;

uniform mat4 uMatrix;
uniform bool u3D;

#include ./ST2XYZ;

varying vec2 vTexcoord;

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

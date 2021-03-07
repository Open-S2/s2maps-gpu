#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;
attribute float aRadius;

uniform mat4 uMatrix;
uniform bool u3D;

@include "./getPos.glsl"

varying vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vec2 pos = aPos;
  vTexcoord = pos;
  // prep xyz
  vec4 xyz = STtoXYZ(pos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 500.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;
}

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;
attribute float aRadius;
attribute float aIndex;

uniform mat4 uMatrix;
uniform bool u3D;

uniform vec4 uColors[16];

@include "./ST2XYZ.glsl"

varying vec4 color;

void main () {
  // set position
  vec4 xyz = STtoXYZ(aPos);
  // if 3D, add radius
  if (u3D) {
    float radius = 1. + (aRadius * 500.);
    xyz.xyz *= radius;
  }
  // set position
  gl_Position = uMatrix * xyz;
  // prep layer index and feature index positions
  int index = int(aIndex);
  // decode color
  color = uColors[index];
  color.rgb *= color.a;
}

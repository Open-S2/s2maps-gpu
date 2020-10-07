#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform float uInputs[16]; // [zoom, ...] we just need zoom

#include ./ST2XYZ;

varying vec2 vPos;

void main () {
  // set position and get it's distance from center
  vec4 pos = uMatrix * STtoXYZ(aPos / 4096.);
  // modify aspect to be a ratio of
  vec2 aspect = uAspect / max(uAspect.x, uAspect.y);
  // get pixel distance
  vPos = pos.xy * aspect * 0.2;
  // add offset
  vPos += vec2(0.25, -0.25);

  gl_Position = pos;
}

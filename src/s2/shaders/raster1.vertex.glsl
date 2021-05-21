#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;

@import "./getPos.glsl"

varying vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 8192.;
  vTexcoord = pos;
  // set position
  gl_Position = getPos(aPos);
}

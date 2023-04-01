precision highp float;

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

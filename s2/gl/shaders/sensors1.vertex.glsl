precision highp float;

attribute vec2 aPos;

@import "./getPos.glsl"

varying vec2 vExtent;

void main () {
  // set where we are on the texture
  vExtent = aPos;
  // set position
  gl_Position = getPos(aPos);
}
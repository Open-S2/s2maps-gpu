#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;

@import "./getPos.glsl"

out vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 8192.;
  vTexcoord = pos;
  // set position
  gl_Position = getPos(aPos);
}

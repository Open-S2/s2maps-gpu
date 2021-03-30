#version 300 es
precision highp float;

@nomangle layout location vTexcoord

layout (location = 0) in vec2 aPos;

@include "./getPos.glsl"

out vec2 vTexcoord;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 8192.;
  vTexcoord = pos;
  // set position
  gl_Position = getPos(aPos);
}

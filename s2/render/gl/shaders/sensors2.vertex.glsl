#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec2 vExtent;
out float vOpacity;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 8192.;
  vExtent = pos;
  // set opacity
  int index = 0;
  int featureIndex = 0;
  vOpacity = decodeFeature(false, index, featureIndex)[0];
  // set position
  gl_Position = getPos(aPos);
}

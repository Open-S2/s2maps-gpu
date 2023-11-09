#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec2 vTexcoord;
out float vOpacity;
out float vSaturation;
out float vContrast;

void main () {
  // set where we are on the texture
  vec2 pos = aPos / 8192.;
  vTexcoord = pos;

  int index = 0;
  int featureIndex = 0;

  vOpacity = decodeFeature(false, index, featureIndex)[0];
  vSaturation = decodeFeature(false, index, featureIndex)[0];
  vContrast = decodeFeature(false, index, featureIndex)[0];

  // set position
  gl_Position = getPos(aPos);
}

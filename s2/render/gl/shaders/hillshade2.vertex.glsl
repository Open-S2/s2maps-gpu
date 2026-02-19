#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec2 vTexcoord;
out float vOpacity;
out vec4 vShadowColor;
out vec4 vAccentColor;
out vec4 vHighlightColor;
out float vAzimuth;
out float vAltitude;

void main () {
  // set where we are on the texture
  vec2 pos = aPos;
  vTexcoord = pos;

  int index = 0;
  int featureIndex = 0;

  vOpacity = decodeFeature(false, index, featureIndex)[0];
  vShadowColor = decodeFeature(true, index, featureIndex);
  vAccentColor = decodeFeature(true, index, featureIndex);
  vHighlightColor = decodeFeature(true, index, featureIndex);
  vAzimuth = min(max(decodeFeature(false, index, featureIndex)[0], 0.), 360.) * PI / 180.;
  vAltitude = min(max(decodeFeature(false, index, featureIndex)[0], 0.), 90.) / 90.;

  // set position
  gl_Position = getPos(aPos);
}

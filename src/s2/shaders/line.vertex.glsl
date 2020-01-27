#version 300 es
precision mediump float;

#define EXTENT 4096

layout (location = 1) in vec2 aPos;
layout (location = 2) in vec2 aNormal;
layout (location = 5) in float aIndex;

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

@import ./decodeFeature;
@import ./rteDSFun90;

out vec4 color;

void main () {
  // prep layer index and feature index positions
  int index = int(aIndex);
  int featureIndex = 0;
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0];
  // multiply width by pos and normal
  vec2 newPos = vec2(pos.x + aNormal.x * width, pos.y + aNormal.y * width);
  // set position
  gl_Position = startingPos + normal;
}

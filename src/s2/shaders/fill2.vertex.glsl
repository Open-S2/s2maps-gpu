#version 300 es
precision highp float;

@nomangle layout location color

layout (location = 0) in vec2 aPos;
layout (location = 7) in float aIndex;

@include "./decodeFeature2.glsl"
@include "./getPos.glsl"

out vec4 color;

void main () {
  // set position
  gl_Position = getPos(aPos);
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  color.a *= decodeFeature(false, index, featureIndex)[0];
  color.rgb *= color.a;
}

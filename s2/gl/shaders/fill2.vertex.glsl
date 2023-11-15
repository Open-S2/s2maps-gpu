#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 1) in vec4 aID;
layout (location = 2) in float aIndex;

uniform bool uInteractive;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec4 color;

void main () {
  // set position
  gl_Position = getPos(aPos);
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  if (uInteractive) {
    color = aID;
  } else {
    color = decodeFeature(true, index, featureIndex);
    color.a *= decodeFeature(false, index, featureIndex)[0];
    color.rgb *= color.a;
  }
}

precision highp float;

attribute vec2 aPos;
attribute float aIndex;

uniform vec4 uColors[16];
uniform float uOpacity[16];

@import "./getPos.glsl"

varying vec4 color;

void main () {
  // set position
  gl_Position = getPos(aPos);
  // prep layer index and feature index positions
  int index = int(aIndex);
  // decode color
  color = uColors[index];
  color *= uOpacity[index];
  color.rgb *= color.a;
}

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

@nomangle aPos aIndex color

attribute vec2 aPos;
attribute float aIndex;

uniform vec4 uColors[16];
uniform float uOpacity;

@include "./getPos.glsl"

varying vec4 color;

void main () {
  // set position
  gl_Position = getPos(aPos);
  // prep layer index and feature index positions
  int index = int(aIndex);
  // decode color
  color = uColors[index];
  color *= uOpacity;
  color.rgb *= color.a;
}

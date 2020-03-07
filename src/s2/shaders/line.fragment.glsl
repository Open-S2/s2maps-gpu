#version 300 es
precision mediump float;

in vec4 color;
// in float lengthSoFar;
out vec4 fragColor;

void main () {
  // float dash = floor(2.0 * fract(lengthSoFar * 20.));
  // if (dash < 0.5) discard;
  if (color.a < 0.01) discard;
  fragColor = color;
}

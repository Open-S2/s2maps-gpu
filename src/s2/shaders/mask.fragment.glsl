#version 300 es
precision mediump float;

uniform sampler2D uTexture;

in vec2 texCoords;

out vec4 color;

void main () {
  color = texture(uTexture, texCoords);
  if (color.a == 0.) discard;
  // color = vec4(0.95686275, 0.9372549, 0.88627451, step(0.5, color.a));
  color.a = step(0.5, color.a);
  // if (color.a < 0.5) discard;
  // else color.a = 1.;
  // else color.a = (color.a - 0.5) * (1. - 0.) / (1. - 0.5);
  // else if (color.a < 0.5) color.a = 0.5;
}

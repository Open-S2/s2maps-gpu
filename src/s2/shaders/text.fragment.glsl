#version 300 es
precision highp float;

// Passed in from the vertex shader.
flat in int iMode;
in vec4 color;
in vec2 vTexcoord;

// The texture.
uniform sampler2D uTexture;

out vec4 fragColor;

void main () {
  // if (iMode == 0 || iMode == 1) fragColor = color;
  // else fragColor = texture(uTexture, vTexcoord);
  // if (fragColor.a <= 0.01) discard;

  if (iMode == 0) fragColor = color;
  else fragColor = texture(uTexture, vTexcoord);
  if (fragColor.a <= 0.01) discard;
}

#version 300 es
precision mediump float;

// Passed in from the vertex shader.
in vec2 vTexcoord;

// The texture.
uniform sampler2D uTexture;

out vec4 fragColor;

void main () {
  vec4 tex = texture(uTexture, vTexcoord);
  if (tex.a < 0.1) discard;
  fragColor = tex;
}

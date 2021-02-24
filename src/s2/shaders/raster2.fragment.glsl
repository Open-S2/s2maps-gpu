#version 300 es
precision highp float;

@nomangle vTexcoord texture uTexture

// Passed in from the vertex shader.
in vec2 vTexcoord;
// The texture.
uniform sampler2D uTexture;

out vec4 fragColor;

void main () {
  fragColor = texture(uTexture, vTexcoord);
}

#version 300 es
precision mediump float;

in vec2 texCoords;

uniform sampler2D uTexture;

out vec4 color;

void main () {
  color = texture(uTexture, texCoords);
}

#version 300 es
precision mediump float;

@import ./color;

in vec4 color;
out vec4 fragColor;

void main () {
  fragColor = LCH2RGB(color);
}

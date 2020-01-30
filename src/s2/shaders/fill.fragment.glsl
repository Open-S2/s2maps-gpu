#version 300 es
precision highp float;

@import ./color;

in vec4 color;
out vec4 fragColor;

void main () {
  // fragColor = LCH2RGB(color);
  fragColor = vec4(0., 0., 0., 1.);
}

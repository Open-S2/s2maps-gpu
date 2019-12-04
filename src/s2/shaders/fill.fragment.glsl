#version 300 es
precision mediump float;

@import ./color;

out vec4 fragColor;

uniform vec4 uColor;

void main () {
  fragColor = LCH2RGB(uColor);
}

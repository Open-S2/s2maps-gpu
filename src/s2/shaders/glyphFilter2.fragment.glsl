#version 300 es
precision highp float;

// uniform int uMode; // 0 => points ; 1 => quads ; 2 => results

in vec4 color;
out vec4 fragColor;

void main () {
  fragColor = color;
}

#version 300 es
precision highp float;

@nomangle vST vColor

in vec2 vST;
in vec4 vColor;

out vec4 fragColor;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  fragColor = vColor;
}

#version 300 es
precision highp float;

in vec2 vST;
out vec4 fragColor;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  fragColor = vec4(1.);
  // fragColor = vec4(0., 0., 0., 1.);
}

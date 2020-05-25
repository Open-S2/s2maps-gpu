#version 300 es
precision highp float;

in vec2 vST;
out vec4 fragColor;

uniform vec4 uColor;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  // fragColor = uColor;
  // fragColor = uColor * 0.003922; // uColor * (1.0 / 255.0)
  fragColor = uColor * (gl_FrontFacing ? 16.0 / 255.0 : 1.0 / 255.0);
  // fragColor = vec4(1.0 / 255.0, 0., 0., 1.);
}

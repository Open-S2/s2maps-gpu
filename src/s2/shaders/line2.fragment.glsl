#version 300 es
precision highp float;

#include ./color;

in vec4 color;
in float vWidth;
in vec2 vNorm;
// in float lengthSoFar;
out vec4 fragColor;

void main () {
  // vec2 st = gl_FragCoord.xy / vWidth;
  // float alpha = smoothstep(1.0, 0.0, st.x);


  // float l = 0.0, delta = 0.0, alpha = 1.0;
  // delta = fwidth(vWidth);
  // alpha = 1.0 - smoothstep(0.5 - vWidth, 0.5 + vWidth, vWidth);
  fragColor = color;
}

#version 300 es
precision highp float;

uniform float uDevicePixelRatio;

in vec4 color;
in vec2 vWidth;
in vec2 vNorm;
// in float lengthSoFar;
out vec4 fragColor;

void main () {
  // Calculate the distance of the pixel from the line in pixels.
  float dist = length(vNorm) * vWidth.s;
  // AA for width and length
  float blur2 = min(1.2, vWidth.s * 0.85);
  float wAlpha = clamp(min(dist - (vWidth.t - blur2), vWidth.s - dist) / blur2, 0., 1.);
  if (wAlpha == 0.) discard;
  // float lAlpha = clamp(, 0., 1.);

  fragColor = color * wAlpha;
  // fragColor = color * min(lAlpha, wAlpha);
}

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
  // AA for width and length (uDevicePixelRatio is the "blur")
  float wAlpha = clamp(min(dist - (vWidth.t - uDevicePixelRatio), vWidth.s - dist) / uDevicePixelRatio, 0., 1.);
  if (wAlpha == 0.) discard;

  fragColor = color * wAlpha;
}

precision highp float;

uniform float uDevicePixelRatio;

varying vec4 color;
varying vec2 vWidth;
varying vec2 vNorm;

void main () {
  // Calculate the distance of the pixel from the line in pixels.
  float dist = length(vNorm) * vWidth.s;
  // AA for width and length (uDevicePixelRatio is the "blur")
  float wAlpha = clamp(min(dist - (vWidth.t - uDevicePixelRatio), vWidth.s - dist) / uDevicePixelRatio, 0., 1.);
  if (wAlpha == 0.) discard;

  gl_FragColor = color * wAlpha;
}

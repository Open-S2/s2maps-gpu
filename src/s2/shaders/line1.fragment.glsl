precision highp float;

varying vec2 vWidth;
varying vec2 vNorm;
varying vec4 color;

void main () {
  // Calculate the distance of the pixel from the line in pixels.
  float dist = length(vNorm) * vWidth.s;
  // AA for width and length
  float blur2 = min(1.2, vWidth.s * 0.85);
  float wAlpha = clamp(min(dist - (vWidth.t - blur2), vWidth.s - dist) / blur2, 0., 1.);
  if (wAlpha == 0.) discard;

  gl_FragColor = color * wAlpha;
}

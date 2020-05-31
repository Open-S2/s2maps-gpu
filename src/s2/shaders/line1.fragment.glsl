precision highp float;

varying vec4 color;
varying vec2 vWidth;
varying vec2 vNorm;

void main () {
  // Calculate the distance of the pixel from the line in pixels.
  float dist = length(vNorm) * vWidth.s;

  // Calculate the antialiasing fade factor. This is either when fading in
  // the line in case of an offset line (vWidth.t) or when fading out (vWidth.s)
  float blur2 = (1. + 1.0) * 0.5;
  float alpha = clamp(min(dist - (vWidth.t - blur2), vWidth.s - dist) / blur2, 0.0, 1.0);

  gl_FragColor = color * alpha;
}

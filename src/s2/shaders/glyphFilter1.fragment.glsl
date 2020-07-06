precision mediump float;

varying vec4 color;

void main () {
  if (color.a <= 0.01) discard;
  gl_FragColor = color;
}

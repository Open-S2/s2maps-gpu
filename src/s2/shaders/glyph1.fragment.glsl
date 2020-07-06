precision mediump float;

varying vec2 vST;

uniform vec4 color;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  gl_FragColor = color;
  // gl_FragColor = vec4(1.0 / 255.0, 0., 0., 1.);
}

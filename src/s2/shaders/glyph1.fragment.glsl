precision highp float;

varying vec2 vST;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  gl_FragColor = vec4(1.0 / 255.0, 0., 0., 1.);
}

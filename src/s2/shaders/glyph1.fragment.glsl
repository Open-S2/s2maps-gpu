precision highp float;

varying vec2 vST;
varying vec4 vColor;

void main () {
  if (vST.x * vST.x - vST.y > 0.) discard;
  gl_FragColor = vColor;
}

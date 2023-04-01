precision highp float;

attribute vec4 aPos;

uniform mat4 uMatrix;

varying vec4 vPos;

void main () {
  vPos = uMatrix * aPos;
  gl_Position = aPos;
  gl_Position.z = 1.0;
}

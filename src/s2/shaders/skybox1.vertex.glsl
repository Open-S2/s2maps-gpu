#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

@nomangle aPos vPos

attribute vec4 aPos;

uniform mat4 uMatrix;

varying vec4 vPos;

void main () {
  vPos = uMatrix * aPos;
  gl_Position = aPos;
  gl_Position.z = 1.0;
}

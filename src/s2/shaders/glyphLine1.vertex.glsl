precision highp float;

attribute vec2 aPos;
attribute vec2 aPar;
attribute vec2 aLimits;
attribute float aScale;

uniform int uOffset;
uniform vec2 uAspect;
uniform float uLineWidth;

varying vec2 vPar;
varying vec2 vLimits;
varying float vDistScale;
varying vec4 vColor;

void main() {
  vPar = aPar;
  vLimits = aLimits;
  vDistScale = aScale / uLineWidth;

  vec2 offset;
  if (uOffset == 0) {
    vColor = vec4(1., 0., 0., 0.);
    offset = vec2(0., 0.33333333);
  } else if (uOffset == 1) {
    vColor = vec4(0., 1., 0., 0.);
    offset = vec2(0.33333333, 0.);
  } else if (uOffset == 2) {
    vColor = vec4(0., 0., 1., 0.);
    offset = vec2(0., -0.33333333);
  } else { // uOffset == 3
    vColor = vec4(0., 0., 0., 1.);
    offset = vec2(-0.33333333, 0.);
  }
  gl_Position = vec4(2. * (aPos + offset) / uAspect - 1., 0., 1.);
}

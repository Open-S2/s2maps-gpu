precision mediump float;

attribute vec2 aPos;
attribute vec2 aPar;
attribute vec2 aLimits;
attribute float aScale;

uniform vec2 uAspect;
uniform float uLineWidth;

varying vec2 vPar;
varying vec2 vLimits;
varying float vDistScale;

void main() {
  vPar = aPar;
  vLimits = aLimits;
  vDistScale = aScale / uLineWidth;

  gl_Position = vec4(2. * aPos / uAspect - 1., 0.0, 1.0);
}

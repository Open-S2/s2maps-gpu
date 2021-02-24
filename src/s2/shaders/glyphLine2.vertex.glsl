#version 300 es
precision highp float;

@nomangle layout location vPar vLimits vDistScale vColor

layout (location = 0) in vec2 aPos;
layout (location = 1) in vec2 aPar;
layout (location = 2) in vec2 aLimits;
layout (location = 3) in float aScale;

out vec2 vPar;
out vec2 vLimits;
out float vDistScale;
out vec4 vColor;

uniform int uOffset;
uniform vec2 uAspect;
uniform float uLineWidth;

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

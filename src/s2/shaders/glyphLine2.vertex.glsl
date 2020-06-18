#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 1) in vec2 aPar;
layout (location = 2) in vec2 aLimits;
layout (location = 3) in float aScale;

uniform vec2 uAspect;
uniform float uLineWidth;

out vec2 vPar;
out vec2 vLimits;
out float vDistScale;

void main() {
  vPar = aPar;
  vLimits = aLimits;
  vDistScale = aScale / uLineWidth;

  gl_Position = vec4(2. * aPos / uAspect - 1., 0.0, 1.0);
}

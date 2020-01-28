#version 300 es
precision highp float;

layout (location = 6) in vec3 aPosHigh;
layout (location = 7) in vec3 aPosLow;
layout (location = 8) in vec2 aTexCoords;

uniform mat4 uMatrix;
uniform vec3 uEyePosHigh;
uniform vec3 uEyePosLow;

@import ./rteDSFun90;

out vec4 color;
out vec2 texCoords;

void main () {
  // GPU-RTE DSFUN90
  vec3 pos = RTE(aPosHigh, aPosLow);
  // set position
  gl_Position = uMatrix * vec4(pos, 1);
  // pass the texCoords through
  texCoords = aTexCoords;
}

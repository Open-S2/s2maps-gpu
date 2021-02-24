#version 300 es
precision highp float;

@nomangle layout location vPos

layout (location = 0) in vec2 aPos;

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform float uInputs[16]; // [zoom, ...] we just need zoom
uniform float uDevicePixelRatio;

@include "./ST2XYZ.glsl"

out vec2 vPos;

void main () {
  // set position and get it's distance from center
  vec4 pos = uMatrix * STtoXYZ(aPos);
  // modify aspect to be a ratio of
  vec2 radius = uAspect / (uDevicePixelRatio * 2.) / (512. * ((uInputs[0] / 2.) + 1.)) / 1000.;
  // get pixel distance
  vPos = pos.xy;
  // add offset
  vPos += vec2(2500., -2500.) * 1000. / uAspect;
  // scale
  vPos *= radius / 7.;

  gl_Position = pos;
}

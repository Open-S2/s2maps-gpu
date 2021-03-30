#version 300 es
precision highp float;

@nomangle layout location vPos

layout (location = 0) in vec2 aPos;

uniform vec2 uAspect;
uniform float uInputs[16]; // [zoom, ...] we just need zoom
uniform float uDevicePixelRatio;

@include "./getPos.glsl"

out vec2 vPos;

void main () {
  // set position and get it's distance from center
  vec4 pos = getPos(aPos);
  pos.xyz /= pos.w;
  pos.w = 1.;
  // modify aspect to be a ratio of
  vec2 radius = uAspect / (uDevicePixelRatio * 2.) / ((uInputs[0] / 1.35) + 1.) / 500.;
  // get pixel distance
  vPos = pos.xy;
  // scale
  vPos *= radius;
  // add offset
  vPos += vec2(300., -175.) / uAspect;

  gl_Position = pos;
}

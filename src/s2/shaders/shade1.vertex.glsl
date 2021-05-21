#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aPos;

uniform vec2 uAspect;
uniform float uInputs[16]; // [zoom, ...] we just need zoom
uniform float uDevicePixelRatio;

@import "./getPos.glsl"

varying vec2 vPos;

void main () {
  // set position and get it's distance from center
  vec4 pos = getPos(aPos);
  pos.xyz /= pos.w;
  pos.w = 1.;
  // modify aspect to be a ratio of
  float zoom = (uInputs[0] < 0.) ? uInputs[0] / 1.45 : uInputs[0];
  vec2 radius = uAspect / (uDevicePixelRatio * 2.) / ((zoom / 1.35) + 1.) / 500.;
  // get pixel distance
  vPos = pos.xy;
  // scale
  vPos *= radius;
  // add offset
  vPos += vec2(300., -175.) / uAspect;

  gl_Position = pos;
}

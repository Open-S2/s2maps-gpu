#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute vec2 aExtent; // the quad
attribute vec2 aPos; // STPoint positional data
// layout (location = 2) in float aID; // float ID
// layout (location = 6) in float aRadius; // world sphere radial adjust

varying vec2 extent;
varying float antialiasFactor;
varying vec4 color;
varying float radius;
varying vec4 stroke;
varying float strokeWidth;

// uniform bool uInteractive;
uniform float uDevicePixelRatio;
uniform vec2 uAspect;

uniform vec4 uColor;
uniform float uRadius;
uniform vec4 uStroke;
uniform float uStrokeWidth;
uniform float uOpacity;

@import "./getPos.glsl"

void main () {
  // decode attributes
  // if (false) {
  //   int id = int(aID);
  //   color = vec4(float(id & 255), float((id >> 8) & 255), float(id >> 16), 1.);
  // } else {
  //   color = decodeFeature(true, index, featureIndex);
  // }
  color = uColor;
  radius = uRadius * uDevicePixelRatio;
  stroke = uStroke;
  strokeWidth = uStrokeWidth * uDevicePixelRatio;
  // if (!uInteractive) opacity = decodeFeature(false, index, featureIndex)[0];
  float opacity = uOpacity;
  // else opacity = 1.;
  // adjust color by opacity
  color.rgb *= color.a;
  color.rgba *= opacity;
  stroke.rgba *= opacity;

  // get position
  vec4 glPos = getPos(aPos);
  vec4 zero = getZero();
  // adjust by w
  glPos.xyz /= glPos.w;
  zero.xyz /= zero.w;
  // if point is behind sphere, drop it.
  if (glPos.z > zero.z) color.a = 0.;
  // cleanup z and w
  glPos.z = 0.;
  glPos.w = 1.;
  // move to specific corner of quad
  glPos.xy += aExtent * (radius + strokeWidth) / uAspect;

  // set extent
  extent = aExtent;
  // set antialias factor
  antialiasFactor = -1. / ((radius + strokeWidth) / uDevicePixelRatio);
  // set position
  gl_Position = glPos;
}

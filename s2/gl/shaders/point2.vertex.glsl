#version 300 es
precision highp float;

layout (location = 0) in vec2 aExtent; // the quad
layout (location = 1) in vec2 aPos; // STPoint positional data
layout (location = 2) in vec4 aID;

out vec2 extent;
out float antialiasFactor;
out vec4 color;
out float radius;
out vec4 stroke;
out float strokeWidth;

uniform bool uInteractive;
uniform float uDevicePixelRatio;
uniform vec4 uBounds;
uniform vec2 uAspect;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

void main () {
  if (aPos.x < uBounds.x || aPos.x > uBounds.z || aPos.y < uBounds.y || aPos.y > uBounds.w) return;
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = 0;
  // decode attributes
  radius = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
  float opacity = decodeFeature(false, index, featureIndex)[0];
  color = decodeFeature(true, index, featureIndex);
  stroke = decodeFeature(true, index, featureIndex);
  strokeWidth = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
  if (!uInteractive) {
    color.rgb *= color.a;
    color *= opacity;
    stroke.rgb *= stroke.a;
    stroke *= opacity;
  } else {
    opacity = 1.;
    color = vec4(aID.rgb, 1.);
    stroke = color;
  }

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

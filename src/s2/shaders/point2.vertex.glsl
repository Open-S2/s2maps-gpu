#version 300 es
precision highp float;

@nomangle layout location extent antialiasFactor color radius stroke strokeWidth opacity uInteractive uDevicePixelRatio

layout (location = 0) in vec2 aExtent; // the quad
layout (location = 1) in vec2 aPos; // STPoint positional data
layout (location = 2) in float aID; // float ID
layout (location = 6) in float aRadius; // world sphere radial adjust

out vec2 extent;
out float antialiasFactor;
out vec4 color;
out float radius;
out vec4 stroke;
out float strokeWidth;
out float opacity;

uniform bool uInteractive;
uniform float uDevicePixelRatio;
uniform vec2 uAspect;
uniform mat4 uMatrix;

@include "./decodeFeature2.glsl"
@include "./ST2XYZ.glsl"

void main () {
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = 0;
  // decode attributes
  if (false) {
    int id = int(aID);
    color = vec4(float(id & 255), float((id >> 8) & 255), float(id >> 16), 1.);
  } else {
    color = decodeFeature(true, index, featureIndex);
  }
  radius = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
  stroke = decodeFeature(true, index, featureIndex);
  strokeWidth = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio;
  if (!uInteractive) opacity = decodeFeature(false, index, featureIndex)[0];
  else opacity = 1.;
  // adjust color by opacity
  color.rgb *= color.a;

  // set position
  // prep xyz
  vec4 xyz = STtoXYZ(aPos);
  // get position
  vec4 glPos = uMatrix * xyz;
  vec4 zero = uMatrix * vec4(0., 0., 0., 1.);
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

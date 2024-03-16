precision highp float;

attribute vec2 aExtent; // the quad
attribute vec2 aPos; // STPoint positional data
attribute vec4 aID;

varying vec2 extent;
varying float antialiasFactor;
varying vec4 color;
varying float radius;
varying vec4 stroke;
varying float strokeWidth;

uniform bool uInteractive;
uniform float uDevicePixelRatio;
uniform vec4 uBounds;
uniform vec2 uAspect;

uniform vec4 uColor;
uniform float uRadius;
uniform vec4 uStroke;
uniform float uSWidth;
uniform float uOpacity;

@import "./color1.glsl"
@import "./getPos.glsl"

void main () {
  if (aPos.x < uBounds.x || aPos.x > uBounds.z || aPos.y < uBounds.y || aPos.y > uBounds.w) return;
  // decode attributes
  color = uColor;
  radius = uRadius * uDevicePixelRatio;
  stroke = uStroke;
  strokeWidth = uSWidth * uDevicePixelRatio;

  float opacity;
  if (!uInteractive) {
    opacity = uOpacity;
    // adjust color by opacity
    color.rgb *= color.a;
    color *= opacity;
    stroke *= opacity;
    if (uCBlind != 0.) {
      color = cBlindAdjust(color);
      stroke = cBlindAdjust(stroke);
    }
  } else {
    opacity = 1.;
    color = vec4(aID.rgb, 1.);
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

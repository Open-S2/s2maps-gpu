#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

attribute float aType;
attribute vec2 aPrev; //   (INSTANCED)
attribute vec2 aCurr; //   (INSTANCED)
attribute vec2 aNext; //   (INSTANCED)

// POSITION TYPES:
// 0 -> curr
// 1 -> curr + (-currNormal)
// 2 -> curr + (currNormal)
// 3 -> next + (-currNormal)
// 4 -> next + (currNormal)
// 5 -> curr + (currNormal) + check ccw
// 6 -> curr + (prevNormal) + check ccw

uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform float uDevicePixelRatio;

uniform vec4 uColor;
uniform float uWidth;

#include ./ST2XYZ;

varying vec2 vWidth;
varying vec2 vNorm;
varying vec4 color;

vec2 perpNormal (in vec2 a, in vec2 b) {
  vec2 delta = a - b;
  float mag = sqrt(delta.x * delta.x + delta.y * delta.y);
  if (mag == 0.) return vec2(0., 0.);
  else return vec2(-delta.y / mag, delta.x / mag);
}

bool isCCW (in vec2 prev, in vec2 curr, in vec2 next) {
  float det = (curr.y - prev.y) * (next.x - curr.x) - (curr.x - prev.x) * (next.y - curr.y);

  return det < 0.;
}

void main () {
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = 0;
  float width;
  vec4 prev, curr, next, zero;
  // decode color
  color = uColor;
  color.rgb *= color.a;
  // decode line width
  width = uWidth * uDevicePixelRatio;
  // explain width to fragment shader
  vWidth = vec2(width, 0.);
  // get the position in projected space
  curr = uMatrix * STtoXYZ(aCurr / 8192.);
  next = uMatrix * STtoXYZ(aNext / 8192.);
  prev = uMatrix * STtoXYZ(aPrev / 8192.);
  zero = uMatrix * vec4(0., 0., 0., 1.);
  // adjust by w & get the position in screen space
  curr.xyz /= curr.w;
  next.xyz /= next.w;
  prev.xyz /= prev.w;
  zero.xyz /= zero.w;

  vec2 currScreen = curr.xy;
  vec2 nextScreen = next.xy;
  vec2 prevScreen = prev.xy;
  vec2 screen = currScreen;
  // grab the perpendicular vector
  vec2 normal;
  if (aType == 0.) normal = vec2(0.);
  else if (aType == 5.) normal = perpNormal(currScreen, prevScreen);
  else normal = perpNormal(nextScreen, currScreen);

  vec4 pos = vec4(0.);

  if (curr.z < zero.z && next.z < zero.z) {
    // adjust normal if necessary
    if (
      aType == 1. || aType == 3. ||
      ((aType == 5. || aType == 6.) && isCCW(prevScreen, currScreen, nextScreen))
    ) normal *= -1.;
    // adjust screen as necessary
    if (aType == 3. || aType == 4.) screen = nextScreen;
    // set position
    pos = vec4(screen + normal * width / uAspect, curr.z, 1.);
  }
  // tell the fragment the normal vector
  vNorm = normal;
  gl_Position = pos;
}

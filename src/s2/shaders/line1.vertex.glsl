precision highp float;

attribute float aType;
attribute vec2 aPrev; //   (INSTANCED)
attribute vec2 aCurr; //   (INSTANCED)
attribute vec2 aNext; //   (INSTANCED)
attribute float aIndex; // (INSTANCED)

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

uniform float uInputs[16];
uniform float uLayerCode[256];
uniform float uFeatureCode[128];

#include ./decodeFeature;
#include ./ST2XYZ;

varying vec2 vWidth;
varying vec2 vNorm;
varying vec4 color;

vec2 normal (in vec2 a, in vec2 b) {
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
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0];
  // explain width to fragment shader
  vWidth = vec2(width, 0.);

  // get the position in projected space
  vec4 curr = uMatrix * STtoXYZ(aCurr / 4096.);
  vec4 next = uMatrix * STtoXYZ(aNext / 4096.);
  vec4 zero = uMatrix * vec4(0., 0., 0., 1.);
  // adjust by w
  curr.xyz /= curr.w;
  next.xyz /= next.w;
  zero.xyz /= zero.w;
  // get the position in screen space
  vec2 currScreen = curr.xy;
  vec2 nextScreen = next.xy;
  // grab the perpendicular vector
  vec2 currNorm = normal(nextScreen, currScreen);

  // if less than 0, ignore the line (zoomed out sphere)
  if (curr.z > zero.z || next.z > zero.z) {
    gl_Position = vec4(0., 0., 0., 0.);
  } else if (aCurr != aNext) {
    if (aType == 0.) {
      gl_Position = vec4(currScreen, curr.z, 1.);
    } else if (aType == 1.) {
      // current point's perp normal with a flipped vector
      currNorm *= -1.;
      gl_Position = vec4(currScreen + (currNorm * width / uAspect), curr.z, 1.);
    } else if (aType == 2.) {
      // current point's perp normal
      gl_Position = vec4(currScreen + (currNorm * width / uAspect), curr.z, 1.);
    } else if (aType == 3.) {
      // next point's perp normal with a flipped vector
      currNorm *= -1.;
      gl_Position = vec4(nextScreen + (currNorm * width / uAspect), curr.z, 1.);
    } else if (aType == 4.) {
      // next point's perp normal
      gl_Position = vec4(nextScreen + (currNorm * width / uAspect), curr.z, 1.);
    } else if (aType == 5. || aType == 6.) {
      // get previous
      vec4 prev = uMatrix * STtoXYZ(aPrev / 4096.);
      prev.xyz /= prev.w;
      vec2 prevScreen = prev.xy;
      vec2 prevNorm = normal(currScreen, prevScreen);
      // if ccw, rotate normal
      if (isCCW(prevScreen, currScreen, nextScreen)) {
        prevNorm *= -1.;
        currNorm *= -1.;
      }
      if (aType == 5.) {
        gl_Position = vec4(currScreen + (currNorm * width / uAspect), curr.z, 1.);
      } else { // aType == 6.
        gl_Position = vec4(currScreen + (prevNorm * width / uAspect), curr.z, 1.);
      }
    } else {
      gl_Position = vec4(0., 0., 0., 0.);
    }
  } else {
    gl_Position = vec4(0., 0., 0., 0.);
  }
  // tell the fragment the normal vector
  vNorm = currNorm;
}

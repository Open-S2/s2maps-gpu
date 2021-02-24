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
uniform float uCap; // 0 -> butt ; 1 -> round ; 2 -> square

uniform vec4 uColor;
uniform float uWidth;

@include "./ST2XYZ.glsl"

varying vec2 vWidth;
varying vec2 vNorm;
varying vec2 vCenter;
varying vec4 vColor;
varying float vDrawType;

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
  vec2 aspectAdjust = vec2(uAspect.x / uAspect.y, 1.);
  // assume standard draw type
  vDrawType = 0.;
  // decode color
  vColor = uColor;
  vColor.rgb *= vColor.a;
  // decode line width
  width = uWidth * uDevicePixelRatio;
  // explain width to fragment shader
  vWidth = vec2(width, 0.);
  // get the position in projected space
  curr = uMatrix * STtoXYZ(aCurr);
  next = uMatrix * STtoXYZ(aNext);
  prev = uMatrix * STtoXYZ(aPrev);
  zero = uMatrix * vec4(0., 0., 0., 1.);
  // adjust by w & get the position in screen space
  curr.xyz /= curr.w;
  next.xyz /= next.w;
  prev.xyz /= prev.w;
  zero.xyz /= zero.w;

  vec2 currScreen = curr.xy * aspectAdjust;
  vec2 nextScreen = next.xy * aspectAdjust;
  vec2 prevScreen = prev.xy * aspectAdjust;
  vec2 screen = curr.xy;
  // grab the perpendicular vector
  vec2 normal;
  vec4 pos = vec4(0.);

  if (curr.z < zero.z && next.z < zero.z) {
    bool currPrev = curr == prev;
    if ( // first case is end caps
      uCap != 0. &&
      (currPrev || curr == next) &&
      (aType == 0. || aType == 5. || aType == 6.)
    ) {
      // set cap type
      vDrawType = uCap;
      // find center
      vCenter = (curr.xy / 2. + 0.5) * uAspect;
      // create normal and adjust if necessary
      normal = (currPrev) ? normalize(nextScreen - currScreen) : normalize(currScreen - prevScreen);
      vec2 capNormal = normal;
      normal = vec2(-normal.y, normal.x);
      if (aType == 0. || aType == 5.) normal *= -1.;
      if (currPrev) capNormal *= -1.;
      // adjust screen position if necessary
      if (aType == 5. || (aType == 6. && currPrev)) screen += capNormal * width / uAspect;
      // set position
      pos = vec4(screen + normal * width / uAspect, 0., 1.);
    } else { // second case: draw a quad line
      // create normalize
      if (aType == 0.) normal = vec2(0.);
      else if (aType == 5.) normal = normalize(currScreen - prevScreen);
      else normal = normalize(nextScreen - currScreen);
      normal = vec2(-normal.y, normal.x);
      // adjust normal if necessary
      if (
        aType == 1. || aType == 3. ||
        ((aType == 5. || aType == 6.) && isCCW(prevScreen, currScreen, nextScreen))
      ) normal *= -1.;
      // adjust screen if necessary
      if (aType == 3. || aType == 4.) screen = next.xy;
      // set position
      pos = vec4(screen + normal * width / uAspect, 0., 1.);
    }
  }
  // tell the fragment the normal vector
  vNorm = normal;
  gl_Position = pos;
}

precision highp float;

attribute float aType;
attribute vec2 aPrev; //   (INSTANCED)
attribute vec2 aCurr; //   (INSTANCED)
attribute vec2 aNext; //   (INSTANCED)
attribute float aIndex; // (INSTANCED)

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

void main () {
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  color = decodeFeature(true, index, featureIndex);
  // decode line width
  float width = decodeFeature(false, index, featureIndex)[0] / 2.;
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
  vec2 currNorm = normalize(nextScreen - currScreen);
  // get the perpendicular of the currNorm -> add the width -> adust by aspect.
  vec2 norm = vec2(-currNorm.y, currNorm.x);

  // if less than 0, ignore the line (zoomed out sphere)
  if (curr.z > zero.z || next.z > zero.z) {
    gl_Position = vec4(0., 0., 0., 0.);
  } else if (aCurr != aNext) {
    if (aType == 0.) {
      // current point's perp normal with a flipped vector
      norm *= -1.;
      gl_Position = vec4(currScreen + (norm * width / uAspect), curr.z, 1.);
    } else if (aType == 1.) {
      // current point's perp normal
      gl_Position = vec4(currScreen + (norm * width / uAspect), curr.z, 1.);
    } else if (aType == 2.) {
      // next point's perp normal with a flipped vector
      norm *= -1.;
      gl_Position = vec4(nextScreen + (norm * width / uAspect), curr.z, 1.);
    } else if (aType == 3.) {
      // next point's perp normal
      gl_Position = vec4(nextScreen + (norm * width / uAspect), curr.z, 1.);
    } else {
      gl_Position = vec4(0., 0., 0., 0.);
    }
  } else {
    gl_Position = vec4(0., 0., 0., 0.);
  }
  // tell the fragment the normal vector
  vNorm = norm;
}

#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif

@nomangle aPos aType vST vColor

attribute vec2 aPos;
attribute float aType;

uniform int uOffset;
uniform vec2 uTexSize;

varying vec2 vST;
varying vec4 vColor;

/**
Since we are drawing quads, there are 4 types
polygons are all defined by type 0: [0, 1]
the start of a quad is defined by type 1: [0, 0]
the middle (control) of a quad is defined by type 2: [0.5, 0]
the end of a quad is defined by type 3: [1, 1]
**/

void main () {
  // setup type
  if (aType == 0.) vST = vec2(0., 1.);
  else if (aType == 1.) vST = vec2(-1., 1.);
  else if (aType == 2.) vST = vec2(0., -1.);
  else vST = vec2(1., 1.);
  // prepare color store and position offset
  vec2 offset;
  if (uOffset == 0) {
    vColor = vec4(1., 0., 0., 0.);
    offset = vec2(0., 0.33333333);
  } else if (uOffset == 1) {
    vColor = vec4(0., 1., 0., 0.);
    offset = vec2(0.33333333, 0.);
  } else if (uOffset == 2) {
    vColor = vec4(0., 0., 1., 0.);
    offset = vec2(0., -0.33333333);
  } else { // uOffset == 3
    vColor = vec4(0., 0., 0., 1.);
    offset = vec2(-0.33333333, 0.);
  }
  // set position (reproject from "0 -> 1" to "(-1) -> 1")
  gl_Position = vec4(2. * (aPos + offset) / uTexSize - 1., 0., 1.);
}

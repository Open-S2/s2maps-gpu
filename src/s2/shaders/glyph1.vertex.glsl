precision mediump float;

attribute vec2 aPos;
attribute float aType;

uniform vec2 uTexSize;

varying vec2 vST;

/**
Since we are drawing quads, there are 4 types
polygons are all defined by type 0: [0, 1]
the start of a quad is defined by type 1: [0, 0]
the middle of a quad is defined by type 2: [0.5, 0]
the end of a quad is defined by type 3: [1, 1]
**/

void main () {
  // setup type
  if (aType == 0.) {
    vST = vec2(0., 1.);
  } else if (aType == 1.) {
    vST = vec2(0., 0.);
  } else if (aType == 2.) {
    vST = vec2(0.5, 0.);
  } else { // type == 3.
    vST = vec2(1., 1.);
  }
  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = vec4(2. * (aPos / uTexSize) - 1., 0, 1);
}

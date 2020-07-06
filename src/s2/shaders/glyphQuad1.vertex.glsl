precision mediump float;

attribute vec2 aUV; // float [u, v]
attribute vec2 aST; // float [s, t]                                  (INSTANCED)
attribute vec2 aXY; // uint16 [x, y]                                 (INSTANCED)
attribute vec2 aTexUV; // uint16 [u, v]                              (INSTANCED)
attribute vec2 aWH; // uint16 [width, height]                        (INSTANCED)
attribute float aID; // float ID                                     (INSTANCED)
attribute vec4 aColor; // normalized uint8 [r, g, b, a]              (INSTANCED)
attribute float aRadius; // float radius                             (INSTANCED)

// glyph texture
uniform vec2 uTexSize;
uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool u3D;
// The glyph filter texture.
uniform sampler2D uFeatures;

#include ./ST2XYZ;

varying vec2 vTexcoord;
varying vec4 color;

// https://gist.github.com/EliCDavis/f35a9e4afb8e1c9ae94cce8f3c2c9b9a
int AND (int n1, int n2) {
  float v1 = float(n1);
  float v2 = float(n2);

  int byteVal = 1;
  int result = 0;

  for (int i = 0; i < 32; i++) {
    bool keepGoing = v1 > 0.0 || v2 > 0.0;
    if (keepGoing) {
      bool addOn = mod(v1, 2.0) > 0.0 && mod(v2, 2.0) > 0.0;

      if (addOn) result += byteVal;

      v1 = floor(v1 / 2.0);
      v2 = floor(v2 / 2.0);
      byteVal *= 2;
    } else { return result; }
  }

  return result;
}

int rightShift (int num, float shifts) {
  return int(floor(float(num) / pow(2.0, shifts)));
}

void main () {
  // prep xyz
  vec4 xyz = STtoXYZ(aST);
  // if 3D, add radius
  // if (u3D) xyz.xyz *= aRadius;
  // for points, add a little to ensure it doesn't get clipped
  xyz.xyz *= 1.001;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;

  // Check the "glyphFilter" result texture at current glPos to see if the aID matches
  // if not, we stop right here for color (discard)
  int id = int(aID);
  ivec3 colorID = ivec3(float(AND(id, 255)), float(AND((rightShift(id, 8.)), 255)), float(rightShift(id, 16.)));
  vec4 inputID = texture2D(uFeatures, vec2(glPos / 2. + 0.5));

  // set color if inputID is same as colorID, otherwise run a "null" color to discard in the frag
  if (colorID == ivec3(inputID.rgb * 256.)) {
    color = aColor;
  } else {
    color = vec4(1., 1., 1., 1.);
  }

  // add x-y offset as well as use the UV to map the quad
  glPos.xy += (aXY / uAspect) + (aWH / uAspect * aUV);
  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
  // set texture position
  vTexcoord = (aTexUV / uTexSize) + (aWH / uTexSize * aUV);
}

precision highp float;

#define MIN_SDF_SIZE 0.08

attribute vec2 aUV; // float [u, v]
attribute vec2 aST; // float [s, t]                   (INSTANCED)
attribute vec2 aXY; // float [x, y]                   (INSTANCED)
attribute vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
attribute vec2 aTexUV; // float [u, v]                (INSTANCED)
attribute vec2 aTexWH; // float [width, height]       (INSTANCED)
attribute float aID; // float ID                      (INSTANCED)

uniform vec2 uTexSize;
uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool uIsFill;
uniform float uDevicePixelRatio;
// WebGL1 specific uniforms
uniform float uSize;
uniform vec4 uFill;
uniform vec4 uStroke;
uniform float uStrokeWidth;

// The glyph filter texture.
uniform sampler2D uFeatures;

#include ./ST2XYZ;

varying float draw;
varying float buf;
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
  // for points, add a little to ensure it doesn't get clipped
  xyz.xyz *= 1.001;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;

  // Check the "glyphFilter" result texture at current glPos to see if the aID matches
  // if not, we stop right here for color (discard)
  int id = int(aID);
  ivec3 colorID = ivec3(float(AND(id, 255)), float(AND(rightShift(id, 8.), 255)), float(rightShift(id, 16.)));
  vec4 inputID = texture2D(uFeatures, vec2(glPos / 2. + 0.5));

  // set color if inputID is same as colorID, otherwise run a "null" color to discard in the frag
  if (colorID == ivec3(inputID.rgb * 256.)) {
    // explain to fragment we are going to draw
    draw = 1.;
    // prep the index and featureIndex
    int index = 0;
    int featureIndex = 0;
    // decode size
    float size = uSize * uDevicePixelRatio;
    float strokeWidth = uStrokeWidth * uDevicePixelRatio;
    color = uFill;
    buf = 0.49;
    if (!uIsFill) {
      color = uStroke;
      if (strokeWidth > 0.) {
        buf = clamp((MIN_SDF_SIZE - buf) * strokeWidth + buf, MIN_SDF_SIZE, buf); // deltaY / deltaX + y-intercept
      }
    }
    vec2 glyphSize = vec2(aTexWH.x * size, size);
    // add x-y offset as well as use the UV to map the quad
    vec2 XY = vec2((aXY.x + aOffset.x) * size - 4., aXY.y - (aOffset.y * size) - 4.); // subtract the sdfWidth
    glPos.xy += (XY / uAspect) + (glyphSize / uAspect * aUV);
    // set texture position
    vTexcoord = (aTexUV / uTexSize) + (vec2(aTexWH.x * aTexWH.y, aTexWH.y) / uTexSize * aUV);
  } else {
    draw = 0.;
    vTexcoord = vec2(0., 0.);
  }
  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
}

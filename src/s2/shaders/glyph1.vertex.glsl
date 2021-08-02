precision highp float;

@define MAX_GAMMA 0.105
@define MIN_GAMMA 0.0525
@define ICON_GAMMA 0.08

attribute vec2 aUV; // float [u, v]
attribute vec2 aST; // float [s, t]                   (INSTANCED)
attribute vec2 aXY; // float [x, y]                   (INSTANCED)
attribute vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
attribute vec2 aWH; // float [width, height]          (INSTANCED)
attribute vec2 aTexXY; // float [x, y]                (INSTANCED)
attribute vec2 aTexWH; // float [width, height]       (INSTANCED)
attribute float aID; // float ID                      (INSTANCED)
attribute vec4 aColor; // [r, g, b, a]                (INSTANCED)

varying float vDraw;
varying float vBuf;
varying float vGamma;
varying vec2 vTexcoord;
varying vec4 vColor;

// glyph texture
uniform bool uIsIcon;
uniform bool uOverdraw;
uniform bool uIsStroke;
uniform vec2 uAspect;
uniform vec2 uTexSize;
uniform vec4 uBounds;
uniform bool uInteractive;
uniform float uDevicePixelRatio;
// The glyph filter texture.
uniform sampler2D uFeatures;

// webgl1 inputs
uniform float uSize;
uniform vec4 uFill;
uniform vec4 uStroke;
uniform float uSWidth;

@import "./getPos.glsl"

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

// text order: (paint)size->strokeWidth->fill->stroke
void main () {
  if (aST.x < uBounds.x || aST.x > uBounds.z || aST.y < uBounds.y || aST.y > uBounds.w) return;
  vec4 glPos = getPos(aST);

  bool shouldDraw = true;
  float strokeWidth;
  vec4 inputID;
  // if we are filtering, check if this glyph was filtered out
  if (!uOverdraw) {
    // Check the "glyphFilter" result texture at current glPos to see if the aID matches
    // if not, we stop right here for color (discard)
    int id = int(aID);
    ivec3 colorID = ivec3(float(AND(id, 255)), float(AND(rightShift(id, 8.), 255)), float(rightShift(id, 16.)));
    inputID = texture2D(uFeatures, vec2(glPos / 2. + 0.5));
    if (colorID != ivec3(inputID.rgb * 256.)) shouldDraw = false;
  } else if (uInteractive) {
    int id = int(aID);
    inputID = vec4(float(AND(id, 255)), float(AND(rightShift(id, 8.), 255)), float(rightShift(id, 16.)), 1.);
    inputID.rgb /= 255.;
  }
  // move on if not drawing
  if (!shouldDraw) return;

  // explain to fragment we are going to draw
  vDraw = (uInteractive) ? 2. : 1.;

  // prep the index and featureIndex
  int index = 0;
  int featureIndex = 0;
  // decode size
  float _size = uSize;
  float size = _size * uDevicePixelRatio * 2.;
  // set fill
  vColor = (uInteractive)
    ? vec4(inputID.rgb, 1.)
    : (uIsIcon)
      ? aColor
      : uFill;
  vColor.rgb *= vColor.a;

  // prep texture read buffer
  vBuf = 0.5;
  if (uIsStroke) {
    strokeWidth = uSWidth;
    if (strokeWidth > 0.) {
      vColor = uStroke;
      vColor.rgb *= vColor.a;
      vBuf = 1. - clamp(0.5 + (strokeWidth / 2.), 0.5, 0.999); // strokeWidth is 0->1
    } else { return; }
  }

  // set gamma based upon size
  vGamma = uIsIcon ? ICON_GAMMA : max(
    MIN_GAMMA,
    min(
      MAX_GAMMA,
      ((MAX_GAMMA - MIN_GAMMA) / (15. - 30.)) * (_size - 15.) + MAX_GAMMA
    )
  );

  // add x-y offset as well as use the UV to map the quad
  vec2 XY = (aXY + (aOffset * size)) / uAspect; // setup the xy positional change in pixels
  vec2 quad = (aWH * size) / uAspect * aUV;
  glPos.xy += XY + quad;
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  if (!uInteractive) vTexcoord = (aTexXY / uTexSize) + (aTexWH / uTexSize * aUV);

  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
}

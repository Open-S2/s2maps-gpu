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
attribute vec4 aColor; // [r, g, b, a]                (INSTANCED)
attribute vec4 aID; // float ID                       (INSTANCED)

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

@import "./color1.glsl"
@import "./getPos.glsl"

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
    inputID = texture2D(uFeatures, vec2(glPos / 2. + 0.5));
    if (aID.rgb != inputID.rgb) shouldDraw = false;
  } else if (uInteractive) {
    inputID = aID;
  }
  // move on if not drawing
  if (!shouldDraw) return;
  // if overdraw we never checked if behind the sphere
  if (uOverdraw) {
    glPos.xyz /= glPos.w;
    glPos.w = 1.;
    vec4 zero = getZero();
    zero.xyz /= zero.w;
    if (glPos.z > zero.z) return;
  }

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
  if (uCBlind != 0.) vColor = cBlindAdjust(vColor);

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

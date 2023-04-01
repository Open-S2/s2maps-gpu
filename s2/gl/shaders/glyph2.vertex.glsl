#version 300 es
precision highp float;

@define MAX_GAMMA 0.105
@define MIN_GAMMA 0.0525
@define ICON_GAMMA 0.08

// aUV is just a 0->1 quad fan
// aST is the position dimension
// aXY is the offset + padding in pixels
// aOffset is the offset relative to the size
// aWH is the dimensions of the quad relative to size
// aTexXY is the starting position in the MTSDF texture
// aTexWH is the width and height of the MTSDF texture
// aID is an 24bit rgb-encoded ID of the whole text
// aColor is the method for icons to understand their color

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]                   (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]                   (INSTANCED)
layout (location = 3) in vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
layout (location = 4) in vec2 aWH; // float [width, height]          (INSTANCED)
layout (location = 5) in vec2 aTexXY; // float [x, y]                (INSTANCED)
layout (location = 6) in vec2 aTexWH; // float [width, height]       (INSTANCED)
layout (location = 7) in vec3 aID; // [r, g, b]                      (INSTANCED)
layout (location = 8) in vec4 aColor; // [r, g, b, a]                (INSTANCED)

out float vBuf;
out float vGamma;
out vec2 vTexcoord;
out vec4 vColor;

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

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

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
    inputID = texture(uFeatures, vec2(glPos / 2. + 0.5));
    if (aID != inputID.rgb) shouldDraw = false;
  } else if (uInteractive) {
    inputID = vec4(aID, 1.);
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
  float _size = decodeFeature(false, index, featureIndex)[0];
  if (uIsIcon) _size = decodeFeature(false, index, featureIndex)[0];
  else decodeFeature(false, index, featureIndex)[0];
  float size = _size * uDevicePixelRatio * 2.;
  // set fill
  if (uInteractive) {
    vColor = vec4(inputID.rgb, 1.);
  } else if (uIsIcon) {
    vColor = aColor;
    if (uCBlind != 0.) vColor = cBlindAdjust(vColor);
  } else {
    vColor = decodeFeature(true, index, featureIndex);
  }
  vColor.rgb *= vColor.a;

  // prep texture read buffer
  vBuf = 0.5;
  if (uIsStroke) {
    strokeWidth = decodeFeature(false, index, featureIndex)[0];
    if (strokeWidth > 0.) {
      vColor = decodeFeature(true, index, featureIndex);
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

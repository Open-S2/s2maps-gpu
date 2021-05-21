#version 300 es
precision highp float;

@define MAX_GAMMA 0.105
@define MIN_GAMMA 0.0525

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
layout (location = 7) in float aID; // float ID                      (INSTANCED)
layout (location = 8) in vec4 aColor; // [r, g, b, a]                (INSTANCED)

out float vDraw;
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
uniform bool uInteractive;
uniform float uDevicePixelRatio;
// The glyph filter texture.
uniform sampler2D uFeatures;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

// text order: (paint)size->strokeWidth->fill->stroke
void main () {
  vec4 glPos;
  if (uFaceST[1] < 12.) {
    vec4 zero = getZero();
    zero.xyz /= zero.w;
    // prep xyz
    vec4 xyz = STtoXYZ(aST);
    // for points, add a little to ensure it doesn't get clipped
    xyz.xyz *= 1.001;
    // find the position on screen
    glPos = uMatrix * xyz;
    glPos.xyz /= glPos.w;
    glPos.w = 1.;
    if (glPos.z > zero.z) return;
  } else {
    glPos = getPosLocal(aST);
  }

  bool shouldDraw = true;
  float strokeWidth;
  vec4 inputID;
  // if we are filtering, check if this glyph was filtered out
  if (!uOverdraw) {
    // Check the "glyphFilter" result texture at current glPos to see if the aID matches
    // if not, we stop right here for color (discard)
    int id = int(aID);
    ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    inputID = texture(uFeatures, vec2(glPos / 2. + 0.5));
    if (colorID != ivec3(inputID.rgb * 256.)) shouldDraw = false;
  } else if (uInteractive) {
    int id = int(aID);
    inputID = vec4(float(id & 255), float((id >> 8) & 255), float(id >> 16), 1.);
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
  float _size = decodeFeature(false, index, featureIndex)[0];
  float size = _size * uDevicePixelRatio * 2.;
  // set fill
  vColor = (uInteractive)
    ? vec4(inputID.rgb, 1.)
    : (uIsIcon)
      ? aColor
      : decodeFeature(true, index, featureIndex);
  vColor.rgb *= vColor.a;

  // prep texture read buffer
  vBuf = 0.49;
  if (uIsStroke) {
    strokeWidth = decodeFeature(false, index, featureIndex)[0];
    if (strokeWidth > 0.) {
      vColor = decodeFeature(true, index, featureIndex);
      vColor.rgb *= vColor.a;
      vBuf = 1. - clamp(0.49 + (strokeWidth / 2.), 0.49, 0.999); // strokeWidth is 0->1
    } else {
      glPos.xy = vec2(0.);
      vColor = vec4(0.);
    }
  }

  // set gamma based upon size
  vGamma = max(
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

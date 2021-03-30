#version 300 es
precision highp float;

#define MIN_SDF_SIZE 0.08

@nomangle layout location draw buf stroke vTexcoord color texture shouldDraw uIsIcon

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]                   (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]                   (INSTANCED)
layout (location = 3) in vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
layout (location = 4) in vec2 aTexUV; // float [u, v]                (INSTANCED)
layout (location = 5) in vec2 aTexWH; // float [width, height]       (INSTANCED)
layout (location = 6) in float aID; // float ID                      (INSTANCED)
layout (location = 7) in vec4 aColor; // [r, g, b, a]                (INSTANCED)

out float draw;
out float buf;
out vec2 vTexcoord;
out vec4 color;
out vec4 stroke;

// glyph texture
uniform bool uIsIcon;
uniform bool uOverdraw;
uniform vec2 uTexSize;
uniform vec2 uAspect;
uniform bool uInteractive;
uniform float uDevicePixelRatio;
// The glyph filter texture.
uniform sampler2D uFeatures;

@include "./decodeFeature2.glsl"
@include "./getPos.glsl"

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
  if (!uOverdraw || uInteractive) {
    // Check the "glyphFilter" result texture at current glPos to see if the aID matches
    // if not, we stop right here for color (discard)
    int id = int(aID);
    ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
    inputID = texture(uFeatures, vec2(glPos / 2. + 0.5));
    if (colorID != ivec3(inputID.rgb * 256.)) shouldDraw = false;
  }
  // move on if not drawing
  if (!shouldDraw) return;

  // explain to fragment we are going to draw
  draw = (uInteractive) ? 2. : 1.;

  // prep the index and featureIndex
  int index = 0;
  int featureIndex = 0;
  // decode size
  float size = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio * 2.;
  // set fill
  color = (uInteractive)
    ? vec4(inputID.rgb, 1.)
    : (uIsIcon)
      ? aColor
      : decodeFeature(true, index, featureIndex);

  color.rgb *= color.a;

  // prep texture read buffer
  buf = 0.49;
  if (!uIsIcon) {
    strokeWidth = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio * 2.;
    stroke = decodeFeature(true, index, featureIndex);
    stroke.rgb *= stroke.a;
    if (strokeWidth > 0.) {
      buf = clamp((MIN_SDF_SIZE - buf) * strokeWidth + buf, MIN_SDF_SIZE, buf); // deltaY / deltaX + y-intercept
    }
  }

  // get the size of the glyph stored
  vec2 glyphSize = vec2(aTexWH.x * size, size);
  // add x-y offset as well as use the UV to map the quad
  vec2 XY = vec2(aXY.x + aOffset.x, aXY.y - aOffset.y) * size; // subtract the sdfWidth
  glPos.xy += (XY / uAspect) + (glyphSize / uAspect * aUV);
  // set texture position (don't bother wasting time looking up if drawing "interactive quad")
  if (!uInteractive) vTexcoord = (aTexUV / uTexSize) + (vec2(aTexWH.x * aTexWH.y, aTexWH.y) / uTexSize * aUV);

  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
}

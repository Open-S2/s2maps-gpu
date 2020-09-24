#version 300 es
precision highp float;

#define MIN_SDF_SIZE 0.08

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]                   (INSTANCED)
layout (location = 2) in vec2 aXY; // float [x, y]                   (INSTANCED)
layout (location = 3) in vec2 aOffset; // float [xOffset, yOffset]   (INSTANCED)
layout (location = 4) in vec2 aTexUV; // float [u, v]                (INSTANCED)
layout (location = 5) in vec2 aTexWH; // float [width, height]       (INSTANCED)
layout (location = 6) in float aID; // float ID                      (INSTANCED)

// glyph texture
uniform vec2 uTexSize;
uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool uIsFill;
uniform float uDevicePixelRatio;
// The glyph filter texture.
uniform sampler2D uFeatures;

#include ./decodeFeature2;
#include ./ST2XYZ;

out float draw;
out float buf;
out vec2 vTexcoord;
out vec4 color;

// text order: (paint)size->strokeWidth->fill->stroke
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
  ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
  vec4 inputID = texture(uFeatures, vec2(glPos / 2. + 0.5));

  // set color if inputID is same as colorID, otherwise run a "null" color to discard in the frag
  if (colorID == ivec3(inputID.rgb * 256.)) {
    // explain to fragment we are going to draw
    draw = 1.;
    // prep the index and featureIndex
    int index = 0;
    int featureIndex = 0;
    // decode size
    float size = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio * 2.;
    float strokeWidth = decodeFeature(false, index, featureIndex)[0] * uDevicePixelRatio * 2.;
    color = decodeFeature(true, index, featureIndex);
    // color = vec4(ivec3(inputID.rgb * 256.), 1.);
    buf = 0.49;
    if (!uIsFill) {
      color = decodeFeature(true, index, featureIndex);
      if (strokeWidth > 0.) {
        buf = clamp((MIN_SDF_SIZE - buf) * strokeWidth + buf, MIN_SDF_SIZE, buf); // deltaY / deltaX + y-intercept
      }
    }
    vec2 glyphSize = vec2(aTexWH.x * size, size);
    // add x-y offset as well as use the UV to map the quad
    vec2 XY = vec2((aXY.x + aOffset.x) * size, aXY.y - (aOffset.y * size)); // subtract the sdfWidth
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

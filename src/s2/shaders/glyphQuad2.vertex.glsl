#version 300 es
precision highp float;

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]                     (INSTANCED)
layout (location = 2) in vec2 aXY; // uint16 [x, y]                    (INSTANCED)
layout (location = 3) in vec2 aTexUV; // uint16 [u, v]                 (INSTANCED)
layout (location = 4) in vec2 aTexWH; // uint16 [width, height]        (INSTANCED)
layout (location = 5) in float aID; // float ID                        (INSTANCED)
layout (location = 6) in vec4 aColor; // normalized uint8 [r, g, b, a] (INSTANCED)
layout (location = 7) in float aRadius; // float radius                (INSTANCED)

// glyph texture
uniform vec2 uTexSize;
uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool u3D;
// The glyph filter texture.
uniform sampler2D uFeatures;

#include ./ST2XYZ;

out vec2 vTexcoord;
out vec4 color;


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
  ivec3 colorID = ivec3(float(id & 255), float((id >> 8) & 255), float(id >> 16));
  vec4 inputID = texture(uFeatures, vec2(glPos / 2. + 0.5));

  // set color if inputID is same as colorID, otherwise run a "null" color to discard in the frag
  if (colorID == ivec3(inputID.rgb * 256.)) {
    color = aColor;
  } else {
    color = vec4(1., 1., 1., 1.);
  }
  // color = vec4(float(id & 255), float((id >> 8) & 255), float(id >> 16), 0.);
  // color = inputID;

  // add x-y offset as well as use the UV to map the quad
  glPos.xy += (aXY / uAspect) + (aTexWH / uAspect * aUV);
  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;
  // set texture position
  vTexcoord = (aTexUV / uTexSize) + (aTexWH / uTexSize * aUV);
}

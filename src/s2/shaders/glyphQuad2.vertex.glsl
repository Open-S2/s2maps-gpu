#version 300 es
precision highp float;

layout (location = 0) in vec2 aUV; // float [u, v]
layout (location = 1) in vec2 aST; // float [s, t]                     (INSTANCED)
layout (location = 2) in vec2 aXY; // uint16 [x, y]                    (INSTANCED)
layout (location = 3) in vec2 aTexUV; // uint16 [u, v]                 (INSTANCED)
layout (location = 4) in vec2 aWH; // uint16 [width, height]           (INSTANCED)
layout (location = 5) in float aID; // float ID                        (INSTANCED)
layout (location = 6) in vec4 aColor; // normalized uint8 [r, g, b, a] (INSTANCED)
layout (location = 7) in float aRadius; // float radius                (INSTANCED)

// glyph texture
uniform vec2 uTexSize;
uniform mat4 uMatrix;
uniform vec2 uAspect;
uniform bool u3D;
// The glyph filter texture.
// uniform sampler2D uGlyphTex;

#include ./ST2XYZ;

out vec2 vTexcoord;
out vec4 color;


void main () {
  // prep xyz
  vec4 xyz = STtoXYZ(aST);
  // if 3D, add radius
  // if (u3D) xyz.xyz *= aRadius;
  // for points, add a little to ensure it doesn't get clipped
  xyz.xyz *= 1.01;
  // find the position on screen
  vec4 glPos = uMatrix * xyz;
  glPos.xyz /= glPos.w;
  glPos.w = 1.;

  // add x-y offset as well as use the UV to map the quad
  glPos.xy += (aXY / uAspect) + (aWH / uAspect * aUV);

  // set position (reproject from "0 - 1" to "(-1) - 1")
  gl_Position = glPos;

  // set texture position
  // vTexcoord = (aTexUV / uTexSize) + (aWH / uTexSize * aUV);
  vTexcoord = (aTexUV) + (aWH * aUV);

  // set color
  color = aColor;
}

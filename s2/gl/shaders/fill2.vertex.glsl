#version 300 es
precision highp float;

layout (location = 0) in vec2 aPos;
layout (location = 1) in vec4 aID;
layout (location = 2) in float aIndex;

uniform bool uInteractive;
uniform vec2 uTexSize;
uniform vec2 uPatternXY;
uniform vec2 uPatternWH;
uniform bool uPatternMovement;

@import "./decodeFeature2.glsl"
@import "./getPos.glsl"

out vec2 vUV;
out vec2 vRegionXY;
out vec2 vRegionWH;
out vec2 vTileFactor;
out vec2 vDeltaMouse;
out vec4 color;
out float alpha;

void main () {
  vec4 pos = getPos(aPos);
  // set position
  gl_Position = pos;
  // set color
  // prep layer index and feature index positions
  int index = 0;
  int featureIndex = int(aIndex);
  // decode color
  if (uInteractive) {
    color = aID;
  } else {
    color = decodeFeature(true, index, featureIndex);
    color.rgb *= color.a;
    alpha = decodeFeature(false, index, featureIndex)[0];
    // build texture data
    if (uPatternWH.x != 0. && uPatternWH.y != 0.) {
      vUV = (pos.xy + 1.) / 2.;
      vRegionXY = uPatternXY / uTexSize;
      vRegionWH = uPatternWH / uTexSize;
      // Scale UV coordinates for tiling (aspect / patternXY)
      vTileFactor = vec2(uInputs[6], uInputs[7]) / uPatternWH;
      // prep deltaMouse
      if (!uPatternMovement) { vDeltaMouse = vec2(0., 0.); }
      else { vDeltaMouse = vec2(uInputs[10], uInputs[11]); }
    }
  }
}

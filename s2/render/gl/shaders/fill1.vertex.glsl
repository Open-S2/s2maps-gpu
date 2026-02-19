precision highp float;

attribute vec2 aPos;
attribute vec4 aID;
attribute float aIndex;

uniform vec4 uColors[16];
uniform float uOpacity[16];
uniform float uInputs[16];
uniform bool uInteractive;
uniform vec2 uTexSize;
uniform vec2 uPatternXY;
uniform vec2 uPatternWH;
uniform bool uPatternMovement;

@import "./color1.glsl"
@import "./getPos.glsl"

varying vec2 vUV;
varying vec2 vRegionXY;
varying vec2 vRegionWH;
varying vec2 vTileFactor;
varying vec2 vDeltaMouse;
varying vec4 color;
varying float alpha;

void main () {
  vec4 pos = getPos(aPos);
  // set position
  gl_Position = pos;
  // prep layer index and feature index positions
  int index = int(aIndex);
  // decode color
  if (uInteractive) {
    color = vec4(aID.rgb, 1.);
    alpha = 1.;
  } else {
    color = uColors[index];
    color.rgb *= color.a;
    alpha = uOpacity[index];
    if (uCBlind != 0.) color = cBlindAdjust(color);
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

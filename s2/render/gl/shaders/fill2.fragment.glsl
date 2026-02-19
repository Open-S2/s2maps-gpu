#version 300 es
precision highp float;

in vec2 vUV;
in vec2 vRegionXY;
in vec2 vRegionWH;
in vec2 vTileFactor;
in vec2 vDeltaMouse;
in vec4 color;
in float alpha;
out vec4 fragColor;

uniform sampler2D uTexture;

void main () {
  if (vRegionWH.x == 0. || vRegionWH.y == 0.) {
    fragColor = color * alpha;
  } else {
    // handle pattern case
    // Calculate UV coordinates within the specified region
    vec2 uv = mod(((vUV + vDeltaMouse) * vTileFactor), 1.) * vRegionWH + vRegionXY;
    // grab the texture color from the pattern at uv coordinates
    vec4 textureColor = texture(uTexture, uv);
    vec4 blendedColor = textureColor * textureColor.a + color * (1. - textureColor.a);
    blendedColor *= alpha;

    fragColor = blendedColor;
  }
}

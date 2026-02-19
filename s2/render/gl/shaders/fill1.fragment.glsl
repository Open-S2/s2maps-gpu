precision highp float;

varying vec2 vUV;
varying vec2 vRegionXY;
varying vec2 vRegionWH;
varying vec2 vTileFactor;
varying vec2 vDeltaMouse;
varying vec4 color;
varying float alpha;

uniform sampler2D uTexture;

void main () {
  if (vRegionWH.x == 0. || vRegionWH.y == 0.) {
    gl_FragColor = color * alpha;
  } else {
    // handle pattern case
    // Calculate UV coordinates within the specified region
    vec2 uv = mod(((vUV + vDeltaMouse) * vTileFactor), 1.) * vRegionWH + vRegionXY;
    // grab the texture color from the pattern at uv coordinates
    vec4 textureColor = texture2D(uTexture, uv);
    vec4 blendedColor = textureColor * textureColor.a + color * (1. - textureColor.a);
    blendedColor *= alpha;

    gl_FragColor = blendedColor;
  }
}

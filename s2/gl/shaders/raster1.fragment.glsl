precision highp float;

// Passed in from the vertex shader.
varying vec2 vTexcoord;
// The texture.
uniform sampler2D uTexture;
uniform float uOpacity;
uniform float uSaturation;
uniform float uContrast;
uniform float uFade;

float getSaturation (in float saturation) {
  saturation = clamp(saturation, -1., 1.);
  if (saturation > 0.) {
    return 1. - 1. / (1.001 - saturation);
  } else {
    return -saturation;
  }
}

float getContrast (in float contrast) {
  contrast = clamp(contrast, -1., 1.);
  if (contrast > 0.) {
    return 1. / (1. - contrast);
  } else {
    return 1. + contrast;
  }
}

void main () {
  vec4 color = texture2D(uTexture, vTexcoord);

  // saturation
  float average = (color.r + color.g + color.b) / 3.0;
  color.rgb += (average - color.rgb) * getSaturation(uSaturation);
  // contrast
  color.rgb = (color.rgb - 0.5) * getContrast(uContrast) + 0.5;
  // opacity
  color *= uOpacity * uFade;

  gl_FragColor = color;
}

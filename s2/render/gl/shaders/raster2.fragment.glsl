#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec2 vTexcoord;
in float vOpacity;
in float vSaturation;
in float vContrast;
// The texture.
uniform sampler2D uTexture;
uniform float uFade;

out vec4 fragColor;

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
  vec4 color = texture(uTexture, vTexcoord);

  // saturation
  float average = (color.r + color.g + color.b) / 3.0;
  color.rgb += (average - color.rgb) * -getSaturation(vSaturation);
  // contrast
  color.rgb = (color.rgb - 0.5) * getContrast(vContrast) + 0.5;
  // opacity
  color *= vOpacity * uFade;

  fragColor = color;
}

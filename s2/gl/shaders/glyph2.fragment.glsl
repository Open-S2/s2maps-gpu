#version 300 es
precision highp float;

// Passed in from the vertex shader.
in float vBuf;
in float vGamma;
in vec2 vTexcoord;
in vec4 vColor;

// The glyph texture.
uniform sampler2D uGlyphTex;
uniform bool uInteractive;
uniform bool uIsIcon;

out vec4 fragColor;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main () {
  if (uInteractive) {
    fragColor = vColor;
  } else {
    bool noAlpha = vColor.a < 0.01;
    vec4 tex = texture(uGlyphTex, vTexcoord);
    // if (tex.a < 0.01) discard;
    if (noAlpha && uIsIcon) {
      fragColor = vColor;
      return;
    } else {
      float opacityS = smoothstep(vBuf - vGamma, vBuf + vGamma, median(tex.r, tex.g, tex.b));
      fragColor = opacityS * vColor;
    }
    fragColor = vColor;
  }
}

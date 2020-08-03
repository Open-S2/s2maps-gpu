#version 300 es
precision highp float;

#define GAMMA 0.040794231 // (1.5 * 1.4142) / (26. * 2.)
#define MIN_ALPHA 0.078125 // 20. / 256.

// Passed in from the vertex shader.
in float draw;
in float buf;
in vec2 vTexcoord;
in vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;

out vec4 fragColor;

void main () {
  if (draw == 0.) discard;
  float dist = texture(uGlyphTex, vTexcoord).r;
  float alpha = smoothstep(buf - GAMMA, buf + GAMMA, dist);
  if (alpha < MIN_ALPHA) discard;
  // fragColor = vec4(1., 1., 1., alpha);
  fragColor = vec4(color.rgb, alpha * color.a);
}

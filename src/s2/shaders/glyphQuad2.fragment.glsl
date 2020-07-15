#version 300 es
precision highp float;

// Passed in from the vertex shader.
in float draw;
in float buf;
in vec2 vTexcoord;
in vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;
// uniform float uSdfLength;
uniform vec2 uTexSize;

out vec4 fragColor;

void main () {
  if (draw == 0.) discard;
  float gamma = 0.040794231; // (1.5 * 1.4142) / (26. * 2.)
  float dist = texture(uGlyphTex, vTexcoord).r;
  float alpha = smoothstep(buf - gamma, buf + gamma, dist);
  if (alpha < 20. / 256.) discard;
  fragColor = vec4(color.rgb, alpha * color.a);
}

// void main () {
// 	fragColor = texture(uGlyphTex, vTexcoord);
// 	if (draw == 0. || fragColor.a == 0.) discard;
// }

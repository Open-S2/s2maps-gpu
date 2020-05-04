#version 300 es
precision highp float;

// Passed in from the vertex shader.
in vec2 vTexcoord;
in vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;

out vec4 fragColor;

void main () {
  vec4 tex = texelFetch(uGlyphTex, ivec2(vTexcoord), 0);
  int r = int(tex.r * 255.);
  if (r % 2 == 0) discard;
  fragColor = color;
  fragColor.a = 1.;
  // fragColor = vec4(tex.r * 50., 0., 0., 1.);
}

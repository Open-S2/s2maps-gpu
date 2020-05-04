precision highp float;

varying vec2 vTexcoord;
varying vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;

void main () {
  vec4 tex = texture2D(uGlyphTex, vTexcoord);
  int r = int(tex.r * 255.);
  if (mod(tex.r * 255., 2.) == 0.) discard;
  gl_FragColor = color;
  gl_FragColor.a = 1.;
}

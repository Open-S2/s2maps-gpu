precision highp float;

#define GAMMA 0.040794231 // (1.5 * 1.4142) / (26. * 2.)
#define MIN_ALPHA 0.078125 // 20. / 256.

// Passed in from the vertex shader.
varying float draw;
varying float buf;
varying vec2 vTexcoord;
varying vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;

void main () {
  if (draw == 0.) {
    discard;
  } else {
    float dist = texture2D(uGlyphTex, vTexcoord).r;
    float alpha = smoothstep(buf - GAMMA, buf + GAMMA, dist);
    if (alpha < MIN_ALPHA) discard;
    gl_FragColor = vec4(color.rgb, alpha * color.a);
  }
}

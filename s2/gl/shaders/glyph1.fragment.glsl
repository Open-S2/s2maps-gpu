precision highp float;

varying float vBuf;
varying float vGamma;
varying vec2 vTexcoord;
varying vec4 vColor;

// The glyph texture.
uniform sampler2D uGlyphTex;
uniform bool uInteractive;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main () {
  if (uInteractive) {
    gl_FragColor = vColor;
  } else {
    vec4 tex = texture2D(uGlyphTex, vTexcoord);
    if (tex.a < 0.01) discard;
    float opacityS = smoothstep(vBuf - vGamma, vBuf + vGamma, median(tex.r, tex.g, tex.b));
    gl_FragColor = opacityS * vColor;
  }
}

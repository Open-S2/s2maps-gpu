precision highp float;

@define GAMMA_TEXT 0.105
@define GAMMA_ICON 0.0525
@define MIN_ALPHA 0.078125 // 20. / 256.

// Passed in from the vertex shader.
varying float draw;
varying float buf;
varying vec2 vTexcoord;
varying vec4 color;
varying vec4 stroke;

uniform bool uIsIcon;
// The glyph texture.
uniform sampler2D uGlyphTex;

void main () {
  if (draw == 2.) {
    gl_FragColor = color;
  } else if (uIsIcon) {
    vec4 tex = texture2D(uGlyphTex, vTexcoord);
    float opacityT = smoothstep(0.5 - GAMMA_ICON, 0.5 + GAMMA_ICON, (tex.r + tex.g + tex.b + tex.a) / 4.);
    if (opacityT < MIN_ALPHA) discard;
    gl_FragColor = color * opacityT;
  } else {
    vec4 tex = texture2D(uGlyphTex, vTexcoord);
    float avg = (tex.r + tex.g + tex.b + tex.a) / 4.;
    float opacityT = smoothstep(buf - GAMMA_TEXT, buf + GAMMA_TEXT, avg);
    if (opacityT < MIN_ALPHA) discard;
    if (buf == 0.5) {
      gl_FragColor = color * opacityT;
    } else {
      float opacityS = smoothstep(0.5 - GAMMA_TEXT, 0.5 + GAMMA_TEXT, avg);
      gl_FragColor = (opacityS == 0.) ? mix(stroke, vec4(0.), 1. - opacityT) : mix(color, stroke, opacityT - opacityS);
    }
  }
}

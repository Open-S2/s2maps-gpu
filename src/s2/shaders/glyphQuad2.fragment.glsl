#version 300 es
precision highp float;

@define GAMMA_TEXT 0.105
@define GAMMA_ICON 0.0525
@define MIN_ALPHA 0.078125 // 20. / 256.

@nomangle draw buf stroke vTexcoord color texture uGlyphTex uIsIcon

// Passed in from the vertex shader.
in float draw;
in float buf;
in vec2 vTexcoord;
in vec4 color;
in vec4 stroke;

uniform bool uIsIcon;
// The glyph texture.
uniform sampler2D uGlyphTex;

out vec4 fragColor;

void main () {
  if (draw == 2.) {
    fragColor = color;
  } else if (uIsIcon) {
    vec4 tex = texture(uGlyphTex, vTexcoord);
    float opacityT = smoothstep(0.49 - GAMMA_ICON, 0.49 + GAMMA_ICON, (tex.r + tex.g + tex.b + tex.a) / 4.);
    if (opacityT < MIN_ALPHA) discard;
    fragColor = color * opacityT;
  } else {
    vec4 tex = texture(uGlyphTex, vTexcoord);
    float avg = (tex.r + tex.g + tex.b + tex.a) / 4.;
    float opacityT = smoothstep(buf - GAMMA_TEXT, buf + GAMMA_TEXT, avg);
    if (opacityT < MIN_ALPHA) discard;
    if (buf == 0.49) {
      fragColor = color * opacityT;
    } else {
      float opacityS = smoothstep(0.49 - GAMMA_TEXT, 0.49 + GAMMA_TEXT, avg);
      fragColor = (opacityS == 0.) ? mix(stroke, vec4(0.), 1. - opacityT) : mix(color, stroke, opacityT - opacityS);
    }
  }
}

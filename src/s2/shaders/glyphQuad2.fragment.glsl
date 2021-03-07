#version 300 es
precision highp float;

@define GAMMA 0.09
@define GAMMA_ICON 0.0525
@define MIN_ALPHA 0.078125 // 20. / 256.

@nomangle draw buf vTexcoord color texture uGlyphTex uIsIcon

// Passed in from the vertex shader.
in float draw;
in float buf;
in vec2 vTexcoord;
in vec4 color;

uniform bool uIsIcon;
uniform bool uColor;
// The glyph texture.
uniform sampler2D uGlyphTex;

out vec4 fragColor;

void main () {
  if (draw == 2.) {
    fragColor = color;
  } else if (uIsIcon) {
    vec4 tex = texture(uGlyphTex, vTexcoord);
    float mid = smoothstep(buf - GAMMA_ICON, buf + GAMMA_ICON, (tex.r + tex.g + tex.b + tex.a) / 4.);
    if (mid < MIN_ALPHA) discard;
    fragColor = color * mid;
  } else {
    vec4 tex = texture(uGlyphTex, vTexcoord);
    float green = smoothstep(buf - GAMMA, buf + GAMMA, tex.g);
    float mid = smoothstep(buf - GAMMA, buf + GAMMA, (tex.r + tex.b) / 2.);
    float alpha = smoothstep(buf - GAMMA, buf + GAMMA, tex.a);
    if (mid < MIN_ALPHA) discard;
    // Average the energy over the pixels on either side
    vec4 rgba = vec4(
  		green,
  		mid,
  		alpha,
  		0.
  	);

    fragColor = (!uColor) ? 1. - (rgba * color.a) : color * rgba;
  }
}

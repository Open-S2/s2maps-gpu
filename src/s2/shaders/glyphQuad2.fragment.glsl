#version 300 es
precision highp float;

#define GAMMA 0.105
#define MIN_ALPHA 0.078125 // 20. / 256.

// Passed in from the vertex shader.
in float draw;
in float buf;
in vec2 vTexcoord;
in vec4 color;

uniform bool uColor;
// The glyph texture.
uniform sampler2D uGlyphTex;

out vec4 fragColor;

void main () {
  if (draw == 0.) {
    discard;
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

    fragColor = (!uColor) ? 1. - rgba : color * rgba;
  }
}

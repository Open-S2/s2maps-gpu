#version 300 es
precision highp float;

#include ./color;

// The glyph texture.
uniform int uMode; // 0 => points ; 1 => quads ; 2 => textures
uniform vec4 uColor;
uniform sampler2D uFillTex;

in vec4 color;
in vec2 vTexcoord;
out vec4 fragColor;

void main () {
  if (uMode == 0) {
    fragColor = color;
  } else {
    vec4 tex = texture(uFillTex, vTexcoord);
    vec4 tex = texelFetch(uFillTex, ivec2(vTexcoord * 1024.), 0);
    int r = int(tex.r * 256.) & int(uColor.r * 256.);
    int g = int(tex.g * 256.) & int(uColor.g * 256.);
    int b = int(tex.b * 256.) & int(uColor.b * 256.);
    int a = int(tex.a * 256.) & int(uColor.a * 256.);
    if (r + g + b + a == 0) discard;
    else fragColor = color;
  }
}

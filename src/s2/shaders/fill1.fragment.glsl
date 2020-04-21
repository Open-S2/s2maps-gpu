precision highp float;

#include ./color;

varying float iMode;
varying vec4 color;
varying vec2 uvPos;

// The evenOdd texture.
uniform sampler2D uTexture;

void main () {
  if (iMode == 2.) {
    float a = mod(texture2D(uTexture, uvPos).r * 255.0, 2.);
    if (a == 0.) discard;
  }
  gl_FragColor = color;
}

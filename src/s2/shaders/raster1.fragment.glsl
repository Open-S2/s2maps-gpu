precision highp float;

@nomangle vTexcoord uTexture

// Passed in from the vertex shader.
varying vec2 vTexcoord;
// The texture.
uniform sampler2D uTexture;

void main () {
  gl_FragColor = texture2D(uTexture, vTexcoord);
}

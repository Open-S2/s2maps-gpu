precision mediump float;

// Passed in from the vertex shader.
varying vec2 vTexcoord;

// The texture.
uniform sampler2D uTexture;

void main () {
  gl_FragColor = texture2D(uTexture, vTexcoord);
}

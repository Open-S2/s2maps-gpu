precision highp float;

// Passed in from the vertex shader.
varying vec2 vExtent;
// The texture.
uniform sampler2D uImage;
uniform sampler2D uNextImage;
uniform sampler2D uColorRamp;
uniform float uTime;
uniform float uOpacity;

void main () {
  // grab the 0->255 value from the texture
  vec4 tex = texture2D(uImage, vExtent);
  // choose the color based on the time;
  // 0->1 is red to green, 1->2 is green to blue, 2->3 is blue to alpha, 3->4 is alpha to red2
  float percent, t;
  if (uTime < 1.0) {
    percent = uTime; // red to green
    t = tex.r * (1.0 - percent) + tex.g * percent;
  } else if (uTime < 2.0) {
    percent = uTime - 1.0; // adjust to 0->1
    t = tex.g * (1.0 - percent) + tex.b * percent;
  } else if (uTime < 3.0) {
    percent = uTime - 2.0; // adjust to 0->1
    t = tex.b * (1.0 - percent) + tex.a * percent;
  } else {
    vec4 tex2 = texture2D(uNextImage, vExtent); // grab the next texture
    percent = uTime - 3.0; // adjust to 0->1
    t = tex.a * (1.0 - percent) + tex2.r * percent;
  }
  // grab the correct color from the color ramp
  vec4 color = texture2D(uColorRamp, vec2(t, 0.5));
  // adjust by opacity
  color *= uOpacity;
  // output the color
  gl_FragColor = color;
}
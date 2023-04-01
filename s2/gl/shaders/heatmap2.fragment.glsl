#version 300 es
precision highp float;

in vec2 vExtent;
in float vOpacity;
in float vS;
out vec4 fragColor;

uniform sampler2D uImage;
uniform sampler2D uColorRamp;
uniform float uDrawState;
uniform float uCBlind;

void main () {
  if (uDrawState == 0.) { // drawing to texture
    float d = -0.5 * 3. * 3. * dot(vExtent, vExtent);
    float val = vS * exp(d);
    fragColor = vec4(val * vOpacity, 1., 1., 1.);
  } else { // drawing to canvas
    float t = texture(uImage, vExtent).r;
    if (t < 0.01) discard;
    vec4 color = texture(uColorRamp, vec2(t, uCBlind / 4.));
    fragColor = color;
  }
}

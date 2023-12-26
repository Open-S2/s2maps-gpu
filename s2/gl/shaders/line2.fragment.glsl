#version 300 es
precision highp float;

in vec2 vWidth;
in vec2 vNorm;
in vec2 vCenter;
in vec4 vColor;
in float vDrawType;
in float vLengthSoFar;

out vec4 fragColor;

uniform float uDevicePixelRatio;
uniform float uDashCount;
uniform float uCBlind;
uniform bool uDashed;
uniform float uTexLength;
uniform sampler2D uDashTexture;

void main () {
  // Calculate the distance of the pixel from the line in pixels.
  float dist, blur, startWidth, endWidth;
  if (vDrawType <= 1.) {
    dist = length(vNorm) * vWidth.s;
    blur = uDevicePixelRatio;
    startWidth = vWidth.t;
    endWidth = vWidth.s;
  } else {
    dist = distance(vCenter, gl_FragCoord.xy);
    blur = uDevicePixelRatio / 2.;
    startWidth = vWidth.t / 2.;
    endWidth = vWidth.s / 2.;
  }
  // AA for width and length
  float wAlpha = clamp(min(dist - (startWidth - blur), endWidth - dist) / blur, 0., 1.);
  if (wAlpha == 0.) discard;

  vec4 color = vColor;

  if (uDashed) {
    color = texture(uDashTexture, vec2(mod(vLengthSoFar, uDashCount) / uTexLength, uCBlind / 4.));
  }

  fragColor = color * wAlpha;
}

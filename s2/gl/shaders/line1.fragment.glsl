precision highp float;

varying vec2 vWidth;
varying vec2 vNorm;
varying vec2 vCenter;
varying vec4 vColor;
varying float vDrawType;
varying float vLengthSoFar;

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
    color = texture2D(uDashTexture, vec2(mod(vLengthSoFar, uDashCount) / uTexLength, uCBlind / 4.));
  }

  gl_FragColor = color * wAlpha;
}

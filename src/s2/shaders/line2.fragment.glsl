#version 300 es
precision highp float;

uniform float uDevicePixelRatio;

in vec4 vColor;
in vec2 vWidth;
in vec2 vNorm;
in vec2 vCenter;
in float vDrawType;
// in float lengthSoFar;
out vec4 fragColor;

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

  fragColor = vColor * wAlpha;
}

precision highp float;

@nomangle vColor vWidth vNorm vCenter vDrawType uDevicePixelRatio

uniform float uDevicePixelRatio;

varying vec4 vColor;
varying vec2 vWidth;
varying vec2 vNorm;
varying vec2 vCenter;
varying float vDrawType;

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

  gl_FragColor = vColor * wAlpha;
}

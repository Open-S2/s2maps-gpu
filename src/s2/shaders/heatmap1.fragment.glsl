precision highp float;

varying vec2 vExtent;
varying float vOpacity;
varying float vS;

uniform sampler2D uImage;
uniform sampler2D uColorRamp;
uniform float uDrawState;

void main () {
  if (uDrawState == 0.) { // drawing to texture
    float d = -0.5 * 3. * 3. * dot(vExtent, vExtent);
    float val = vS * exp(d);
    gl_FragColor = vec4(val * vOpacity, 1., 1., 1.);
  } else { // drawing to canvas
    float t = texture2D(uImage, vExtent).r;
    if (t < 0.01) discard;
    vec4 color = texture2D(uColorRamp, vec2(t, 0.5));
    gl_FragColor = color;
  }
}

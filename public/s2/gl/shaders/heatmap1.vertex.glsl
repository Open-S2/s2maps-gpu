precision highp float;

@define ZERO 0.00196078431372549 // 1. / 255. / 2.
@define GAUSS_COEF 0.3989422804014327

attribute vec2 aExtent; // the quad
attribute vec2 aPos; // STPoint positional data
attribute float aWeight; // user inputed weight

varying vec2 vExtent;
varying float vOpacity;
varying float vS;

uniform float uDevicePixelRatio;
uniform float uDrawState;
uniform vec4 uBounds;
uniform vec2 uAspect;

uniform float uIntensity;
uniform float uRadius;
uniform float uOpacity;

@import "./getPos.glsl"

void main () {
  vec4 glPos;
  if (uDrawState == 0.) { // drawing to texture
    if (aPos.x < uBounds.x || aPos.x > uBounds.z || aPos.y < uBounds.y || aPos.y > uBounds.w) return;
    // set position
    // prep xyz & get position
    glPos = getPos(aPos);
    glPos.xyz /= glPos.w;
    // set extent & weight
    vExtent = aExtent;
    // prep layer index and feature index positions
    int index = 0;
    int featureIndex = 0;
    // decode attributes
    float intensity = uIntensity;
    float radius = uRadius * uDevicePixelRatio * 2.;
    vOpacity = uOpacity;

    // set zero
    vec4 zero = uMatrix * vec4(0., 0., 0., 1.);
    zero.xyz /= zero.w;
    // if point is behind sphere, drop it.
    if (glPos.z > zero.z) {
      glPos.xy = vec2(0., 0.);
      vS = 0.;
    } else {
      // cleanup z and w
      glPos.z = 0.;
      glPos.w = 1.;
      // move to specific corner of quad
      glPos.xy += aExtent * radius / uAspect;

      // set strength
      vExtent *= sqrt(-2. * log(ZERO / aWeight / intensity / GAUSS_COEF)) / 3.;
      vS = aWeight * intensity * GAUSS_COEF;
    }
  } else { // draw to canvas
    glPos = vec4(aExtent, 0., 1.);
    vExtent = glPos.xy * 0.5 + 0.5;
  }
  // set position
  gl_Position = glPos;
}

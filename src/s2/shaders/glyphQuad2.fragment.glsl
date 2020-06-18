#version 300 es
precision highp float;

// Passed in from the vertex shader.
in float draw;
in vec2 vTexcoord;
in vec4 color;

// The glyph texture.
uniform sampler2D uGlyphTex;
// uniform float uSdfLength;
uniform float uSdfAspect;
uniform vec2 uTexSize;

out vec4 fragColor;

/*
 *  Subpixel coverage calculation
 *
 *  v - edge slope    -1.0 to 1.0          triplet
 *  a - pixel coverage 0.0 to 1.0          coverage
 *
 *      |<- glyph edge                      R  G  B
 *  +---+---+                             +--+--+--+
 *  |   |XXX| v = 1.0 (edge facing west)  |  |xx|XX|
 *  |   |XXX| a = 0.5 (50% coverage)      |  |xx|XX|
 *  |   |XXX|                             |  |xx|XX|
 *  +---+---+                             +--+--+--+
 *    pixel                                0  50 100
 *
 *
 *        R   G   B
 *
 *   1.0        +--+   <- top (abs( v ))
 *              |
 *       -+-----+--+-- <- ceil: 100% coverage
 *        |     |XX|
 *   0.0  |  +--+XX|
 *        |  |xx|XX|
 *       -+--+--+--+-- <- floor: 0% coverage
 *           |
 *  -1.0  +--+         <-  -abs(v)
 *        |
 *        |
 *        |
 *  -2.0  +            <- bottom: -abs(v)-1.0
 */

// vec3 subpixel (float v, float a) {
//   float vt = 0.6 * v; // 1.0 will make your eyes bleed
//   vec3 rgb_max = vec3(-vt, 0., vt);
//   float top = abs(vt);
//   float bottom = -top - 1.;
//   float cfloor = mix(top, bottom, a);
//   vec3 res = clamp(rgb_max - vec3(cfloor), 0., 1.);
//   return res;
// }
//
// void main () {
// 	if (draw == 0.) discard;
//   // Sampling the texture, L pattern
//   float sdf = texture(uGlyphTex, vTexcoord).r;
//   float sdfNorth = texture(uGlyphTex, vTexcoord + vec2(0., 1. / uTexSize.y)).r;
//   float sdfEast = texture(uGlyphTex, vTexcoord + vec2(1. / uTexSize.x, 0.)).r;
//
//   // Estimating stroke direction by the distance field gradient vector
//   vec2 sgrad = vec2(sdfEast - sdf, sdfNorth - sdf);
//   float sgradLen = max(length(sgrad), 1. / 128.);
//   vec2 grad = sgrad / vec2(sgradLen);
//   float vgrad = abs(grad.y); // 0.0 - vertical stroke, 1.0 - horizontal one
//
//   float horzScale = 1.1; // Blurring vertical strokes along the X axis a bit
//   float vertScale = 0.6; // While adding some contrast to the horizontal strokes
//   float hdoffset = mix(uSdfAspect * horzScale, uSdfAspect * vertScale, vgrad);
//   float resDoffset = mix(uSdfAspect, hdoffset, 1.);
//
//   float alpha = smoothstep(0.49 - resDoffset, 0.49 + resDoffset, sdf);
//   // Additional contrast
//   alpha = pow(alpha, 1. + 0.2 * vgrad);
//
//   // Discarding pixels beyond a threshold to minimise possible artifacts.
//   if (alpha < 20. / 256.) discard;
//
//   vec3 channels = subpixel(grad.x * 0.49, alpha);
//   // For subpixel rendering we have to blend each color channel separately
//   vec3 res = mix(vec3(1.), color.rgb, channels);
//
//   fragColor = vec4(res, color.a * alpha);
// }

// void main () {
// 	if (draw == 0.) discard;
//   // Sampling the texture, L pattern
//   float sdf = texture(uGlyphTex, vTexcoord).r;
//   float sdfNorth = texture(uGlyphTex, vTexcoord + vec2(0., 1. / uTexSize.y)).r;
//   float sdfEast = texture(uGlyphTex, vTexcoord + vec2(1. / uTexSize.x, 0.)).r;
//   if (sdf < 0.49) discard;
//   fragColor = color;
// }

void main () {
  if (draw == 0.) discard;
  float buf = 0.49;
  float gamma = (1.5 * 1.4142) / (26. * 2.);
  float dist = texture(uGlyphTex, vTexcoord).r;
  float alpha = smoothstep(buf - gamma, buf + gamma, dist);
  if (alpha < 20. / 256.) discard;
  fragColor = vec4(color.rgb, alpha * color.a);
}


// void main () {
// 	fragColor = texture(uGlyphTex, vTexcoord);
// 	if (draw == 0. || fragColor.a == 0.) discard;
// }

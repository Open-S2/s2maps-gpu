precision highp float;

@define PI 3.1415926538

// Passed in from the vertex shader.
varying vec2 vTexcoord;
// The texture.
uniform sampler2D uTexture;
uniform float uOpacity;
uniform vec4 uShadowColor;
uniform vec4 uAccentColor;
uniform vec4 uHighlightColor;
uniform float uAzimuth;
uniform float uAltitude;
uniform float uFade;
uniform float uTexLength;
// [offset, zFactor, rMul, gMul, bMul, aMul]
uniform float uUnpack[6];

float getElevation (vec2 uv) {
  vec4 color = texture2D(uTexture, uv);
  return uUnpack[0] + (
    (
      color.r * uUnpack[2] +
      color.g * uUnpack[3] +
      color.b * uUnpack[4] +
      color.a * uUnpack[5]
    )
    * uUnpack[1]
  );
}

void main () {
  // load 3x3 window
  float cellSize = 1. / uTexLength;
  // adjust extent to go from 0-1 to not include the edges since the texture is oversized
  vec2 uv = vTexcoord * ((uTexLength - 2.) / uTexLength) + cellSize;
  // cellSize is the length of (for example) 0->514; create a uv variable that is extent,
  float a = getElevation(uv + vec2(-cellSize, -cellSize));
  float b = getElevation(uv + vec2(0., -cellSize));
  float c = getElevation(uv + vec2(cellSize, -cellSize));
  float d = getElevation(uv + vec2(-cellSize, 0.));
  float e = getElevation(uv);
  float f = getElevation(uv + vec2(cellSize, 0.));
  float g = getElevation(uv + vec2(-cellSize, cellSize));
  float h = getElevation(uv + vec2(0., cellSize));
  float i = getElevation(uv + vec2(cellSize, cellSize));

  // let multiplier = pow(2., vExaggeration + (19.2562 - view.zoom));
  float dzDx = (c + f + f + i) - (a + d + d + g);
  float dzDy = (g + h + h + i) - (a + b + b + c);

  // We divide the slope by a scale factor based on the cosin of the pixel's approximate latitude
  // to account for mercator projection distortion. see #4807 for details
  // TODO:
  // float scaleFactor = cos(radians((uLatRange[0] - uLatRange[1]) * (1. - v_pos.y) + uLatRange[1]));
  float scaleFactor = 10.;
  // We also multiply the slope by an arbitrary z-factor of 1.25
  float slope = atan(1.25 * length(vec2(dzDx, dzDy)) / scaleFactor);
  float aspect = dzDx != 0. ? atan(dzDy, -dzDx) : PI / 2. * (dzDy > 0. ? 1. : -1.);

  // We add PI to make this property match the global light object, which adds PI/2 to the light's azimuthal
  // position property to account for 0deg corresponding to north/the top of the viewport in the style spec
  // and the original shader was written to accept (-illuminationDirection - 90) as the azimuthal.
  float azimuth = uAzimuth + PI;

  // We scale the slope exponentially based on altitude, using a calculation similar to
  // the exponential interpolation function in the style spec:
  // src/style-spec/expression/definitions/interpolate.js#L217-L228
  // so that higher altitude values create more opaque hillshading.
  float base = 1.875 - uAltitude * 1.75;
  float maxValue = 0.5 * PI;
  float scaledSlope = uAltitude != 0.5
    ? ((pow(base, slope) - 1.) / (pow(base, maxValue) - 1.)) * maxValue
    : slope;

  // The accent color is calculated with the cosine of the slope while the shade color is calculated with the sine
  // so that the accent color's rate of change eases in while the shade color's eases out.
  // We multiply both the accent and shade color by a clamped altitude value
  // so that intensities >= 0.5 do not additionally affect the color values
  // while altitude values < 0.5 make the overall color more transparent.
  float clampedAltitude = clamp(uAltitude * 2., 0., 1.);
  vec4 accentColor = uAccentColor * (1. - cos(scaledSlope)) * clampedAltitude;
  float shade = abs(mod(((aspect + azimuth) / PI + 0.5), 2.) - 1.);
  vec4 shadeColor = mix(uShadowColor, uHighlightColor, shade) * sin(scaledSlope) * clampedAltitude;

  gl_FragColor = (accentColor * (1. - shadeColor.a) + shadeColor) * uOpacity * uFade;
}

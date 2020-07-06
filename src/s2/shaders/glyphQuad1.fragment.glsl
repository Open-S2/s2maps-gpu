#extension GL_OES_standard_derivatives:enable
precision mediump float;

varying vec2 vTexcoord;
varying vec4 color;

uniform bool uColor;
// The glyph texture.
uniform sampler2D uGlyphTex;

void main () {
	if (color.a > 0.98) discard;
  // Get samples for -2/3 and -1/3
	vec2 valueL = texture2D(uGlyphTex, vec2(vTexcoord.x + dFdx(vTexcoord.x), vTexcoord.y)).yz * 255.0;
	vec2 lowerL = mod(valueL, 16.0);
	vec2 upperL = (valueL - lowerL) / 16.0;
	vec2 alphaL = min(abs(upperL - lowerL), 2.0);

	// Get samples for 0, +1/3, and +2/3
	vec3 valueR = texture2D(uGlyphTex, vTexcoord).xyz * 255.0;
	vec3 lowerR = mod(valueR, 16.0);
	vec3 upperR = (valueR - lowerR) / 16.0;
	vec3 alphaR = min(abs(upperR - lowerR), 2.0);

	// Average the energy over the pixels on either side
	vec4 rgba = vec4(
		(alphaR.x + alphaR.y + alphaR.z) / 6.0,
		(alphaL.y + alphaR.x + alphaR.y) / 6.0,
		(alphaL.x + alphaL.y + alphaR.x) / 6.0,
		0.0
	);

	// Optionally scale by a color
	gl_FragColor = (!uColor) ? 1.0 - rgba : color * rgba;
	// gl_FragColor = (!uColor) ? 0.5 - rgba : color * rgba;
}

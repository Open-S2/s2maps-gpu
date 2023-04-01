uniform float uCBlind;
uniform float uCVD[9];

// COLOR BLIND ADJUST:
// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js

vec4 cBlindAdjust (in vec4 rgba) {
	// setup rgb
	float r = rgba.r * 255.;
	float g = rgba.g * 255.;
	float b = rgba.b * 255.;
	// RGB to LMS matrix conversion
	float L = (17.8824 * r) + (43.5161 * g) + (4.11935 * b);
	float M = (3.45565 * r) + (27.1554 * g) + (3.86714 * b);
	float S = (0.0299566 * r) + (0.184309 * g) + (1.46709 * b);
	// Simulate color blindness
	float l = (uCVD[0] * L) + (uCVD[1] * M) + (uCVD[2] * S);
	float m = (uCVD[3] * L) + (uCVD[4] * M) + (uCVD[5] * S);
	float s = (uCVD[6] * L) + (uCVD[7] * M) + (uCVD[8] * S);
	// LMS to RGB matrix conversion
	float R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	float G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	float B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = r - R;
	G = g - G;
	B = b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	float GG = (0.7 * R) + (1.0 * G);
	float BB = (0.7 * R) + (1.0 * B);
	// Add compensation to original values, clamp to 0->255 range, rescope to 0->1 range.
	return vec4(
		clamp(r, 0., 255.) / 255.,
		clamp(GG + g, 0., 255.) / 255.,
		clamp(BB + b, 0., 255.) / 255.,
		rgba.a
	);
}

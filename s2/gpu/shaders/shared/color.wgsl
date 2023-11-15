const PI = 3.1415926538;

// LCH

fn LCH2LAB (lch: vec4<f32>) -> vec4<f32> { // r -> l ; g -> c ; b -> h
  var h = lch.b * (PI / 180.);
  return vec4<f32>(
    lch.r,
    cos(h) * lch.g, // change c to a
    sin(h) * lch.g, // change h to b
    lch.a
  );
}

fn LAB2XYZ (t: f32) -> f32 {
  if (t > 0.206896552) { return t * t * t; }
  else { return 0.12841855 * (t - 0.137931034); }
}

fn XYZ2RGB (r: f32) -> f32 {
  var _r = 0.0f;
  if (r <= 0.00304) {
    _r = 12.92 * r;
  } else {
    _r = 1.055 * pow(r, 1. / 2.4) - 0.055;
  }
  return 255. * _r;
}

fn LAB2RGB (lab: vec4<f32>) -> vec4<f32> { // r -> l ; g -> a ; b -> b
  // prep move to xyz
  var y = (lab.r + 16.) / 116.;
  var x = y + lab.g / 500.;
  var z = y - lab.b / 200.;
  // solve x, y, z
  x = 0.950470 * LAB2XYZ(x);
  y = 1. * LAB2XYZ(y);
  z = 1.088830 * LAB2XYZ(z);
  // xyz to rgb
  var r = XYZ2RGB(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  var g = XYZ2RGB(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z);
  var b = XYZ2RGB(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
  // clip space from 0 to 255
  if (r < 0.) { r = 0.; }
  else if (r > 255.) { r = 255.; }
  if (g < 0.) { g = 0.; }
  else if (g > 255.) { g = 255.; }
  if (b < 0.) { b = 0.; }
  else if (b > 255.) { b = 255.; }
  // return updated values
  return vec4<f32>(r, g, b, lab.a);
}

fn LCH2RGB (lch: vec4<f32>) -> vec4<f32> {
  // first convert to lab
  var res = LCH2LAB(lch);
  // convert from lab to rgb
  res = LAB2RGB(res);
  // lastly, divide each number by clip space size 255
  res.r /= 255.;
  res.g /= 255.;
  res.b /= 255.;
  return res;
}

// COLOR BLIND ADJUST:
// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js
fn cBlindAdjust (rgba: vec4<f32>) -> vec4<f32> {
  // setup rgb
  var r = rgba.r * 255.;
  var g = rgba.g * 255.;
  var b = rgba.b * 255.;
  // grab color conversion mode
  var CVD = array<f32, 9>();
  if (layerUniforms.uCBlind == 1u) { CVD = array<f32, 9>(0.0, 2.02344, -2.52581, 0., 1., 0., 0., 0., 1.); } // protanopia
  else if (layerUniforms.uCBlind == 2u) { CVD = array<f32, 9>(1.0, 0., 0., 0.494207, 0., 1.24827, 0., 0., 1.); } // deutranopia
  else { CVD = array<f32, 9>(1.0, 0., 0., 0., 1.0, 0., -0.395913, 0.801109, 0.); } // tritanopia
  // RGB to LMS matrix conversion
	var L = (17.8824 * r) + (43.5161 * g) + (4.11935 * b);
	var M = (3.45565 * r) + (27.1554 * g) + (3.86714 * b);
	var S = (0.0299566 * r) + (0.184309 * g) + (1.46709 * b);
	// Simulate color blindness
	var l = (CVD[0] * L) + (CVD[1] * M) + (CVD[2] * S);
	var m = (CVD[3] * L) + (CVD[4] * M) + (CVD[5] * S);
	var s = (CVD[6] * L) + (CVD[7] * M) + (CVD[8] * S);
	// LMS to RGB matrix conversion
	var R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	var G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	var B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = r - R;
	G = g - G;
	B = b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	var GG = (0.7 * R) + (1.0 * G);
	var BB = (0.7 * R) + (1.0 * B);
	// Add compensation to original values, clamp to 0->255 range, rescope to 0->1 range.
  return vec4<f32>(
    clamp(r, 0., 255.) / 255.,
    clamp(GG + g, 0., 255.) / 255.,
    clamp(BB + b, 0., 255.) / 255.,
    rgba.a
  );
}

#define PI 3.1415926538

vec4 LCH2LAB (vec4 lch) { // r -> l ; g -> c ; b -> h
  float h = lch.b * (PI / 180.);
  return vec4(
    lch.r,
    cos(h) * lch.g, // change c to a
    sin(h) * lch.g, // change h to b
    lch.a
  );
}

float LAB2XYZ (float t) {
  return t > 0.206896552 ? t * t * t : 0.12841855 * (t - 0.137931034);
}

float XYZ2RGB (float r) {
  return 255. * (r <= 0.00304 ? 12.92 * r : 1.055 * pow(r, 1. / 2.4) - 0.055);
}

vec4 LAB2RGB (vec4 lab) { // r -> l ; g -> a ; b -> b
  float x, y, z, r, g, b;
  // prep move to xyz
  y = (lab.r + 16.) / 116.;
  if (isnan(lab.g)) x = y;
  else x = y + lab.g / 500.;
  if (isnan(lab.b)) z = y;
  else z = y - lab.b / 200.;
  // solve x, y, z
  x = 0.950470 * LAB2XYZ(x);
  y = 1. * LAB2XYZ(y);
  z = 1.088830 * LAB2XYZ(z);
  // xyz to rgb
  r = XYZ2RGB(3.2404542 * x - 1.5371385 * y - 0.4985314 * z);
  g = XYZ2RGB(-0.9692660 * x + 1.8760108 * y + 0.0415560 * z);
  b = XYZ2RGB(0.0556434 * x - 0.2040259 * y + 1.0572252 * z);
  // clip space from 0 to 255
  if (r < 0.) r = 0.;
  else if (r > 255.) r = 255.;
  if (g < 0.) g = 0.;
  else if (g > 255.) g = 255.;
  if (b < 0.) b = 0.;
  else if (b > 255.) b = 255.;
  // return updated values
  return vec4(r, g, b, lab.a);
}

vec4 LCH2RGB (vec4 lch) {
  vec4 res;
  // first convert to lab
  res = LCH2LAB(lch);
  // convert from lab to rgb
  res = LAB2RGB(res);
  // lastly, divide each number by clip space size 255
  res.r /= 255.;
  res.g /= 255.;
  res.b /= 255.;
  return res;
}

vec4 interpolateColor (vec4 color1, vec4 color2, float t) {
  // dummy check
  if (t == 0.) return color1;
  else if (t == 1.) return color2;
  float sat, hue, lbv, dh, alpha;
  // create proper hue translation
  if (!isinf(color1.r) && !isinf(color2.r)) {
    if (color2.r > color1.r && color2.r - color1.r > 180.) dh = color2.r - (color1.r + 360.);
    else if (color2.r < color1.r && color1.r - color2.r > 180.) dh = color2.r + 360. - color1.r;
    else dh = color2.r - color1.r;
    hue = color1.r + t * dh;
  } else if (!isinf(color1.r)) {
    hue = color1.r;
    if (color2.b == 1. || color2.b == 0.) sat = color1.g;
  } else if (!isinf(color2.r)) {
    hue = color2.r;
    if (color1.b == 1. || color1.b == 0.) sat = color2.g;
  } else {
    hue = 0.;
  }
  // saturation
  if (!isnan(sat)) sat = color1.g + t * (color2.g - color1.g);
  // luminosity
  lbv = color1.b + t * (color2.b - color1.b);
  // alpha
  alpha = color1.a + t * (color2.a - color1.a);
  // create the new color
  return vec4(hue, sat, lbv, alpha);
}

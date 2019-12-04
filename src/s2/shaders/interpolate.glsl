#version 300 es
precision mediump float;

// y = e^x OR y = Math.pow(2, 10 * x)
float exponentialInterpolation (float input, float start, float end, float base) {
  // grab change
  float diff = end - start;
  if (diff === 0.) return 0.;
  // refine base value
  if (base <= 0.) base = 0.1;
  else if (base > 2.) base = 2.;
  // grab diff
  float progress = input - start;
  // linear case
  if (base === 1.) return progress / diff;
  // solve
  return (pow(base, progress) - 1.) / (pow(base, diff) - 1.);
}

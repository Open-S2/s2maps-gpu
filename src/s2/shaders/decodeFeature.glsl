vec4 decodeFeature (bool color, int index, int featureIndex) {
  // prep variables
  int startIndex = index;
  int conditionCode = int(uLayerCode[index]);
  int len = conditionCode >> 10;
  int condition = (conditionCode & 1008) >> 4;
  // int inputType = (conditionCode & 14) >> 1;
  // int interpolationType = conditionCode & 1;
  index++;
  // create base, if exponential interpolation, we need to grab the base value and increment
  // float base = 1.;
  // if (interpolationType == 1) {
  //   base = uLayerCode[index];
  //   index++;
  // }
  // run through conditions
  if (condition == 0) {
  } else if (condition == 1) { // value
    return vec4(uLayerCode[index], uLayerCode[index + 1], uLayerCode[index + 2], uLayerCode[index + 3]);
  } else if (condition == 2 || condition == 3) { // data-condition or input-condition
    // // run through each condition, when match is found, set value
    // float inputVal, value;
    // // setup inputVal
    // if (condition == 2) {
    //   inputVal = uFeatureCode[featureIndex];
    //   featureIndex++;
    // } else { inputVal = uInputs[inputType]; }
    // // prep
    // value = uLayerCode[index];
    // while (inputVal != value) {
    //   // increment index & find len
    //   index += int(uLayerCode[index + 1]) >> 10 + 1;
    //   value = uLayerCode[index];
    // }
    // // now we are in the proper place, we increment once and find grab the value
    // decodeFeature(uLayerCode, uFeatureCode, uInputs, res, color, index + 1, featureIndex);
  } else if (condition == 4 || condition == 5) { // data-range or input-range
    // float inputVal, start, end;
    // vec4 val1(-1., -1., -1., -1.);
    // vec4 val2(-1., -1., -1., -1.);
    // // grab the inputVal value
    // if (condition == 4) {
    //   inputVal = uFeatureCode[featureIndex];
    //   featureIndex++;
    // } else { inputVal = uInputs[inputType] }
    // // create a start point
    // start = end = uLayerCode[index];
    // index++;
    // // iterate through the current conditionalEncodings and match the indices with inputVal
    // while (end < inputVal && inputVal < len) {
    //   vec2 indexes = decodeFeature(uLayerCode, uFeatureCode, uInputs, val1, color, index, featureIndex);
    //   index = indexes[0];
    //   featureIndex = indexes[1];
    //   // update end and index
    //   start = end;
    //   end = uLayerCode[index];
    //   index++;
    // }
    // if (end == inputVal) {
    //   decodeFeature(uLayerCode, uFeatureCode, uInputs, res, color, index, featureIndex);
    // } else if (index >= len) { // just not found
    //   res = val1;
    // } else if (val1[0] == -1) { // if val1 is still a negative number than decode start and set it to res
    //   decodeFeature(uLayerCode, uFeatureCode, uInputs, res, color, index, featureIndex);
    // } else { // otherwise find val2, interpolate
    //   decodeFeature(uLayerCode, uFeatureCode, uInputs, val2, color, index, featureIndex);
    //   // get interpolation
    //   float t = exponential(inputVal, start, end, base); // default base of 1 makes a linear interpolation
    //   if (color) res = interpolateColor(val1, val2, t);
    //   else res[0] = val1[0] + t * (val2[0] - val1[0]);
    // }
  } else if (condition == 6) { // animation-state

  } else if (condition >= 7) { // feature-state

  }
  // return indexing state for range based computations
  // return vec2(startIndex + len, featureIndex);
  return vec4(0, 0, 0, 0.5);
}

// y = e^x OR y = Math.pow(2, 10 * x)
float exponentialInterpolation (float inputVal, float start, float end, float base) {
  // grab change
  float diff = end - start;
  if (diff == 0.) return 0.;
  // refine base value
  if (base <= 0.) base = 0.1;
  else if (base > 2.) base = 2.;
  // grab diff
  float progress = inputVal - start;
  // linear case
  if (base == 1.) return progress / diff;
  // solve
  return (pow(base, progress) - 1.) / (pow(base, diff) - 1.);
}

vec4 interpolateColor (vec4 color1, vec4 color2, float t) {
  // dummy check
  if (t == 0.) return color1;
  else if (t == 1.) return color2;
  float sat, hue, lbv, dh, alpha;
  // create proper hue translation
  if (!isinf(color1[0]) && !isinf(color2[0])) {
    if (color2[0] > color1[0] && color2[0] - color1[0] > 180.) dh = color2[0] - (color1[0] + 360.);
    else if (color2[0] < color1[0] && color1[0] - color2[0] > 180.) dh = color2[0] + 360. - color1[0];
    else dh = color2[0] - color1[0];
    hue = color1[0] + t * dh;
  } else if (!isinf(color1[0])) {
    hue = color1[0];
    if (color2[2] == 1. || color2[2] == 0.) sat = color1[1];
  } else if (!isinf(color2[0])) {
    hue = color2[0];
    if (color1[2] == 1. || color1[2] == 0.) sat = color2[1];
  } else {
    hue = 0.;
  }
  // saturation
  if (!isnan(sat)) sat = color1[1] + t * (color2[1] - color1[1]);
  // luminosity
  lbv = color1[2] + t * (color2[2] - color1[2]);
  // alpha
  alpha = color1[3] + t * (color2[3] - color1[3]);
  // create the new color
  return vec4(hue, sat, lbv, alpha);
}

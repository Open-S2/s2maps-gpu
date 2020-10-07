uniform int uFeatureState;
uniform float uInputs[16]; // [zoom, lon, lat, angle, pitch, time, ...extensions]
uniform float uLayerCode[128];
uniform float uFeatureCode[64];
uniform bool uLCH;

#include ./color;

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
  // LCH interpolation
  if (uLCH) { // create proper hue translation
    if (color2[0] > color1[0] && color2[0] - color1[0] > 180.) dh = color2[0] - color1[0] + 360.;
    else if (color2[0] < color1[0] && color1[0] - color2[0] > 180.) dh = color2[0] + 360. - color1[0];
    else dh = color2[0] - color1[0];
    hue = color1[0] + t * dh;
  } else { // otherwise red
    hue = color1[0] + t * (color2[0] - color1[0]);
  }
  // saturation or green
  sat = color1[1] + t * (color2[1] - color1[1]);
  // luminosity or blue
  lbv = color1[2] + t * (color2[2] - color1[2]);
  // alpha
  alpha = color1[3] + t * (color2[3] - color1[3]);
  // create the new color
  return vec4(hue, sat, lbv, alpha);
}

vec4 decodeFeature (bool color, inout int index, inout int featureIndex) {
  // prep result and variables
  int decodeOffset = index;
  int startingOffset = index;
  int featureSize = int(uLayerCode[index]) >> 10;
  vec4 res = vec4(-1, -1, -1, -1);
  int conditionStack[6];
  float tStack[6];
  int stackIndex = 1; // start at 1 because our first condition will be the initial starting point
  conditionStack[0] = index;
  int len, conditionSet, condition;

  do {
    stackIndex--;
    // pull out current stackIndex condition an decode
    startingOffset = index = conditionStack[stackIndex];
    conditionSet = int(uLayerCode[index]);
    len = conditionSet >> 10;
    condition = (conditionSet & 1008) >> 4;
    index++;
    // for each following condition, pull out the eventual color and set to val
    if (condition == 0) {
    } else if (condition == 1) { // value
      if (res[0] == -1.) {
        for (int i = 0; i < len - 1; i++) res[i] = uLayerCode[index + i];
      } else {
        if (color) {
          vec4 val = vec4(uLayerCode[index], uLayerCode[index + 1], uLayerCode[index + 2], uLayerCode[index + 3]);
          res = interpolateColor(res, val, tStack[stackIndex]);
        } else {
          for (int i = 0; i < len - 1; i++) res[i] = res[i] + tStack[stackIndex] * (uLayerCode[index + i] - res[i]);
        }
      }
    } else if (condition == 2 || condition == 3) { // data-condition & input-condition
      // get the input from either uFeatureCode or uInputs
      float inputVal, conditionInput;
      if (condition == 2) {
        inputVal = uFeatureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[(conditionSet & 14) >> 1]; }
      // now that we have the inputVal, we iterate through and find a match
      conditionInput = uLayerCode[index];
      while (inputVal != conditionInput) {
        // increment index & find length
        index += (int(uLayerCode[index + 1]) >> 10) + 1;
        conditionInput = uLayerCode[index];
        // if we hit the default, than the value does not exist
        if (conditionInput == 0.) break;
      }
      index++; // increment to conditionEncoding
      // now add subCondition to be parsed
      conditionStack[stackIndex] = index;
      tStack[stackIndex] = 1.;
      stackIndex++; // increment size of stackIndex
    } else if (condition == 4 || condition == 5) { // data-range & input-range
      // get interpolation & base
      int interpolationType = conditionSet & 1;
      int inputType = (conditionSet & 14) >> 1;
      float base = 1.;
      if (interpolationType == 1) {
        base = uLayerCode[index];
        index++;
      }
      // find the two values and run them
      float inputVal, start, end;
      int startIndex, endIndex, subCondition;
      // grab the inputVal value
      if (condition == 4) {
        inputVal = uFeatureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[inputType]; }
      // create a start point
      start = end = uLayerCode[index];
      startIndex = endIndex = index + 1;
      while (end < inputVal && endIndex < len + startingOffset) {
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the uFeatureCode that was stored there
        subCondition = (int(uLayerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) featureIndex++;
        // increment to subCondition
        index++;
        // increment by subConditions length
        index += int(uLayerCode[index]) >> 10;
        // set new start and end
        start = end;
        startIndex = endIndex;
        endIndex = index + 1;
        if (endIndex < len + startingOffset) end = uLayerCode[index];
      }
      // if start and end are the same, we only need to process the first piece
      if (startIndex == endIndex) {
        conditionStack[stackIndex] = startIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) tStack[stackIndex] = tStack[stackIndex - 1];
        // else tStack[stackIndex] = 1.; UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else if (end == inputVal) {
        conditionStack[stackIndex] = endIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) tStack[stackIndex] = tStack[stackIndex - 1];
        // else tStack[stackIndex] = 1.; UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else { // otherwise we process startIndex and endIndex
        float t = exponentialInterpolation(inputVal, start, end, base);
        conditionStack[stackIndex] = startIndex;
        tStack[stackIndex] = 1. - t;
        stackIndex++;
        conditionStack[stackIndex] = endIndex;
        tStack[stackIndex] = t;
        stackIndex++;
      }
      // now that we got the information we need - we need to ensure we flush all feature subCondition data
      // hidden in zooms that we had to parse in the setup stage
      while (endIndex < len + startingOffset) {
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the uFeatureCode that was stored there
        subCondition = (int(uLayerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) featureIndex++;
        index++;
        index += int(uLayerCode[index]) >> 10;
        endIndex = index + 1;
      }
    } else if (condition == 6) { // feature-state
      // iterate through subConditions until it matches "uFeatureState"
      // once found, inject
    } else if (condition == 7) { // animation-state

    }
    // safety precaution
    if (stackIndex > 5) {
      index = featureSize + decodeOffset;
      // convert if lch
      if (color && uLCH) res = LCH2RGB(res);
      return res;
    }
  } while (stackIndex > 0);

  // update index to the next Layer property
  index = featureSize + decodeOffset;

  // convert if lch
  if (color && uLCH) res = LCH2RGB(res);
  return res;
}

// y = e^x OR y = Math.pow(2, 10 * x)
fn exponentialInterpolation (inputVal: f32, start: f32, end: f32, base: f32) -> f32 {
  // grab change
  var diff = end - start;
  if (diff == 0.) { return 0.; }
  // refine base value
  var mutBase = base;
  if (mutBase <= 0.) { mutBase = 0.1; }
  else if (mutBase > 2.) { mutBase = 2.; }
  // grab diff
  var progress = inputVal - start;
  // linear case
  if (mutBase == 1.) { return progress / diff; }
  // solve
  return (pow(mutBase, progress) - 1.) / (pow(mutBase, diff) - 1.);
}

fn interpolateColor (color1: vec4<f32>, color2: vec4<f32>, t: f32) -> vec4<f32> {
  // dummy check
  if (t == 0.) { return color1; }
  else if (t == 1.) { return color2; }
  var hue = 0.;
  // LCH interpolation
  if (layer.useLCH != 0.) { // create proper hue translation
    var dh = 0.;
    if (color2[0] > color1[0] && color2[0] - color1[0] > 180.) { dh = color2[0] - color1[0] + 360.; }
    else if (color2[0] < color1[0] && color1[0] - color2[0] > 180.) { dh = color2[0] + 360. - color1[0]; }
    else { dh = color2[0] - color1[0]; }
    hue = color1[0] + t * dh;
  } else { // otherwise red
    hue = color1[0] + t * (color2[0] - color1[0]);
  }
  // saturation or green
  var sat = color1[1] + t * (color2[1] - color1[1]);
  // luminosity or blue
  var lbv = color1[2] + t * (color2[2] - color1[2]);
  // alpha
  var alpha = color1[3] + t * (color2[3] - color1[3]);
  // create the new color
  return vec4<f32>(hue, sat, lbv, alpha);
}

fn decodeFeature (color: bool, indexPtr: ptr<function, i32>, featureIndexPtr: ptr<function, i32>) -> vec4<f32> {
  let uInputs = array<f32, 10>(view.zoom, view.lon, view.lat, view.bearing, view.pitch, view.time, view.aspectX, view.aspectY, view.featureState, view.curFeature);
  // prep result and variables
  var index = i32(*indexPtr);
  var featureIndex = i32(*featureIndexPtr);
  var decodeOffset = index;
  var startingOffset = index;
  var featureSize = i32(layerCode[index]) >> 10;
  var res = vec4<f32>(-1., -1., -1., -1.);
  var conditionStack = array<i32, 6>();
  var tStack = array<f32, 6>();
  var stackIndex = i32(1); // start at 1 because our loop decrements this at start
  conditionStack[0] = index;
  var len = 0;
  var conditionSet = 0;
  var condition = 0;

  loop {
    stackIndex--;
    // pull out current stackIndex condition an decode
    index = conditionStack[stackIndex];
    startingOffset = index;
    conditionSet = i32(layerCode[index]);
    len = conditionSet >> 10;
    condition = (conditionSet & 1008) >> 4;
    index++;
    // for each following condition, pull out the eventual color and set to val
    if (condition == 0) {
    } else if (condition == 1) { // value
      if (res[0] == -1.) {
        for (var i = 0; i < len - 1; i++) {
          res[i] = f32(layerCode[index + i]);
        }
      } else {
        if (color) {
          var val = vec4<f32>(layerCode[index], layerCode[index + 1], layerCode[index + 2], layerCode[index + 3]);
          res = interpolateColor(res, val, tStack[stackIndex]);
        } else {
          for (var i = 0; i < len - 1; i++) {
            res[i] = res[i] + tStack[stackIndex] * (layerCode[index + i] - res[i]);
          }
        }
      }
    } else if (condition == 2 || condition == 3) { // data-condition & input-condition
      // get the input from either featureCode or uInputs
      var inputVal = 0.;
      var conditionInput = 0.;
      if (condition == 2) {
        inputVal = featureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[(conditionSet & 14) >> 1]; }
      // now that we have the inputVal, we iterate through and find a match
      conditionInput = layerCode[index];
      while (inputVal != conditionInput) {
        // increment index & find length
        index += (i32(layerCode[index + 1]) >> 10) + 1;
        conditionInput = layerCode[index];
        if (conditionInput == 0.) { break; }
      }
      index++; // increment to conditionEncoding
      // now add subCondition to be parsed
      conditionStack[stackIndex] = index;
      tStack[stackIndex] = 1.;
      stackIndex++; // increment size of stackIndex
    } else if (condition == 4 || condition == 5) { // data-range & input-range
      // get interpolation & base
      var interpolationType = conditionSet & 1;
      var inputType = (conditionSet & 14) >> 1;
      var base = 1.;
      if (interpolationType == 1) {
        base = layerCode[index];
        index++;
      }
      // find the two values and run them
      var inputVal = 0.;
      var start = 0.;
      var end = 0.;
      var startIndex = 0;
      var endIndex = 0;
      var subCondition = 0;
      // grab the inputVal value
      if (condition == 4) {
        inputVal = featureCode[featureIndex];
        featureIndex++;
      } else { inputVal = uInputs[inputType]; }
      // create a start point
      end = layerCode[index];
      start = end;
      endIndex = index + 1;
      startIndex = endIndex;
      while (end < inputVal && endIndex < len + startingOffset) {
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the featureCode that was stored there
        subCondition = (i32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        // increment to subCondition
        index++;
        // increment by subConditions length
        index += i32(layerCode[index]) >> 10;
        // set new start and end
        start = end;
        startIndex = endIndex;
        endIndex = index + 1;
        if (endIndex < len + startingOffset) { end = layerCode[index]; }
      }
      // if start and end are the same, we only need to process the first piece
      if (startIndex == endIndex) {
        conditionStack[stackIndex] = startIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1]; }
        else { tStack[stackIndex] = 1.; } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else if (end == inputVal) {
        conditionStack[stackIndex] = endIndex;
        tStack[stackIndex] = 1.;
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1]; }
        else { tStack[stackIndex] = 1.; } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++;
      } else { // otherwise we process startIndex and endIndex
        var t = exponentialInterpolation(inputVal, start, end, base);
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
        // we must move past the featureCode that was stored there
        subCondition = (i32(layerCode[startIndex]) & 1008) >> 4;
        if (subCondition == 2 || subCondition == 4) { featureIndex++; }
        index++;
        index += i32(layerCode[index]) >> 10;
        endIndex = index + 1;
      }
    } else if (condition == 6) { // feature-state
      // iterate through subConditions until it matches "uFeatureState"
      // once found, inject
      res = vec4<f32>(0., 0., 0., 1.);
      return res;
    } else if (condition == 7) { // animation-state

    } else if (condition == 8) { // input-value
      // get length
      len = i32(featureCode[featureIndex]);
      featureIndex++;
      // get value(s)
      for (var i = 0; i < len; i++) {
        res[i] = featureCode[featureIndex];
        featureIndex++;
      }
    }

    continuing {
      // if our stackIndex is done or we went to far (bug) then we break
      break if (stackIndex <= 0 || stackIndex > 5);
    }
  }

  // update index to the next Layer property
  *indexPtr = featureSize + decodeOffset;
  *featureIndexPtr = featureIndex;

  // if lch: convert back to rgb
  if (color && layer.useLCH != 0.) { res = LCH2RGB(res); }
  // assuming user has selected a colorblind state, adjust accordingly
  if (color && view.cBlind != 0.) { res = cBlindAdjust(res); }

  return res;
}

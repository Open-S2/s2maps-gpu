const view = {
  cBlind: 0, // colorblind support
  zoom: 3.24, // exact zoom
  lon: -94.58488464355469,
  lat: 30.769155502319336,
  bearing: 0,
  pitch: 0,
  time: 0,
  aspectX: 3420,
  aspectY: 1288,
  featureState: 0,
  curFeature: 0,
  devicePixelRatio: 2
}

const layerCode = [10320, 0, 2064, 14, 3, 2064, 22, 4, 2064, 24, 2064, 16, 5136, 0.10196078431372549, 0.45098039215686275, 0.9058823529411765, 1, 2064, 0.5, 5136, 1, 1, 1, 0.75]
const featureCode = [0]

type Color = [number, number, number, number]

function interpolateColor (color1: Color, color2: Color, t: number): Color {
  // dummy check
  if (t === 0.0) { return color1 } else if (t === 1.0) { return color2 }
  const hue = color1[0] + t * (color2[0] - color1[0])
  // saturation or green
  const sat = color1[1] + t * (color2[1] - color1[1])
  // luminosity or blue
  const lbv = color1[2] + t * (color2[2] - color1[2])
  // alpha
  const alpha = color1[3] + t * (color2[3] - color1[3])
  // create the new color
  return [hue, sat, lbv, alpha]
}

function exponentialInterpolation (inputVal: number, start: number, end: number, base: number): number {
  // grab change
  const diff = end - start
  if (diff === 0.0) { return 0.0 }
  // refine base value
  let mutBase = base
  if (mutBase <= 0.0) { mutBase = 0.1 } else if (mutBase > 2.0) { mutBase = 2.0 }
  // grab diff
  const progress = inputVal - start
  // linear case
  if (mutBase === 1.0) { return progress / diff }
  // solve
  return (Math.pow(mutBase, progress) - 1.0) / (Math.pow(mutBase, diff) - 1.0)
}

function decodeFeature (color: boolean, indexPtr: { ptr: number }, featureIndexPtr: { ptr: number }): Color {
  const uInputs = [view.zoom, view.lon, view.lat, view.bearing, view.pitch, view.time, view.aspectX, view.aspectY, view.featureState, view.curFeature]
  // prep result and variables
  const decodeOffset = indexPtr.ptr
  let startingOffset = indexPtr.ptr
  const featureSize = layerCode[indexPtr.ptr] >> 10
  let res: Color = [-1.0, -1.0, -1.0, -1.0]
  const conditionStack = [0, 0, 0, 0, 0, 0]
  const tStack = [0, 0, 0, 0, 0, 0]
  let stackIndex = 1 // start at 1 because our loop decrements this at start
  conditionStack[0] = indexPtr.ptr
  let len = 0
  let conditionSet = 0
  let condition = 0

  let bigLoopTotal = 0
  while (true) {
    bigLoopTotal++
    if (bigLoopTotal > 100) { console.info('FOUND'); break }
    stackIndex--
    // pull out current stackIndex condition an decode
    indexPtr.ptr = conditionStack[stackIndex]
    startingOffset = indexPtr.ptr
    conditionSet = layerCode[indexPtr.ptr]
    len = conditionSet >> 10
    condition = (conditionSet & 1008) >> 4
    console.info('condition', condition)
    indexPtr.ptr++
    // for each following condition, pull out the eventual color and set to val
    if (condition === 0) {
      // do nothing
    } else if (condition === 1) { // value
      console.info('CONDITION 1 BEGIN')
      if (res[0] === -1.0) {
        console.info('LEN', len)
        for (let i = 0; i < len - 1; i++) {
          res[i] = layerCode[indexPtr.ptr + i]
        }
        console.info('NEW RES', res)
      } else {
        if (color) {
          const val: Color = [layerCode[indexPtr.ptr], layerCode[indexPtr.ptr + 1], layerCode[indexPtr.ptr + 2], layerCode[indexPtr.ptr + 3]]
          console.info('INTERPOLATE', res, val, tStack[stackIndex])
          res = interpolateColor(res, val, tStack[stackIndex])
        } else {
          console.info('INTERPOLATE', len, res, layerCode[indexPtr.ptr], tStack[stackIndex])
          for (let i = 0; i < len - 1; i++) {
            res[i] = res[i] + tStack[stackIndex] * (layerCode[indexPtr.ptr + i] - res[i])
          }
        }
      }
    } else if (condition === 2 || condition === 3) { // data-condition || input-condition
      // get the input from either featureCode or uInputs
      let inputVal = 0.0
      let conditionInput = 0.0
      if (condition === 2) {
        inputVal = featureCode[featureIndexPtr.ptr]
        featureIndexPtr.ptr++
      } else { inputVal = uInputs[(conditionSet & 14) >> 1] }
      // now that we have the inputVal, we iterate through and find a match
      conditionInput = layerCode[indexPtr.ptr]
      while (true) {
        // if we found condition, move on if we hit the default, than the value does not exist
        if (inputVal === conditionInput || conditionInput === 0.0) { break }
        // increment indexPtr.ptr & find length
        indexPtr.ptr += (layerCode[indexPtr.ptr + 1] >> 10) + 1
        conditionInput = layerCode[indexPtr.ptr]
      }
      indexPtr.ptr++ // increment to conditionEncoding
      // now add subCondition to be parsed
      conditionStack[stackIndex] = indexPtr.ptr
      tStack[stackIndex] = 1.0
      stackIndex++ // increment size of stackIndex
    } else if (condition === 4 || condition === 5) { // data-range || input-range
      // get interpolation & base
      const interpolationType = conditionSet & 1
      const inputType = (conditionSet & 14) >> 1
      let base = 1.0
      if (interpolationType === 1) {
        base = layerCode[indexPtr.ptr]
        indexPtr.ptr++
      }
      // find the two values and run them
      let inputVal = 0.0
      let start = 0.0
      let end = 0.0
      let startIndex = 0
      let endIndex = 0
      let subCondition = 0
      // grab the inputVal value
      if (condition === 4) {
        inputVal = featureCode[featureIndexPtr.ptr]
        featureIndexPtr.ptr++
      } else { console.info('INPUT', uInputs[inputType]); inputVal = uInputs[inputType] }
      // create a start point
      end = layerCode[indexPtr.ptr]
      start = end
      endIndex = indexPtr.ptr + 1
      startIndex = endIndex
      let loopTotal = 0
      while (end < inputVal && endIndex < len + startingOffset) {
        console.info('end < inputVal', end, inputVal, end < inputVal)
        console.info('endIndex < len + startingOffset', endIndex, len + startingOffset, endIndex < len + startingOffset)
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the featureCode that was stored there
        subCondition = (layerCode[startIndex] & 1008) >> 4
        if (subCondition === 2 || subCondition === 4) { featureIndexPtr.ptr++ }
        // increment to subCondition
        indexPtr.ptr++
        // increment by subConditions length
        indexPtr.ptr += layerCode[indexPtr.ptr] >> 10
        // set new start and end
        start = end
        startIndex = endIndex
        endIndex = indexPtr.ptr + 1
        if (endIndex < len + startingOffset) { end = layerCode[indexPtr.ptr] }
        loopTotal++
        if (loopTotal > 100) { console.info('FOUND'); break }
      }
      console.info('subCondition', subCondition)
      console.info('startIndex', startIndex)
      console.info('endIndex', endIndex)
      console.info('start', start)
      console.info('end', end)
      console.info('inputVal', inputVal)
      // if start and end are the same, we only need to process the first piece
      if (startIndex === endIndex) {
        conditionStack[stackIndex] = startIndex
        tStack[stackIndex] = 1.0
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1] } else { tStack[stackIndex] = 1.0 } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++
      } else if (end === inputVal) {
        conditionStack[stackIndex] = endIndex
        tStack[stackIndex] = 1.0
        if (stackIndex > 0) { tStack[stackIndex] = tStack[stackIndex - 1] } else { tStack[stackIndex] = 1.0 } // UNKOWN WHY - THIS CAUSES AN ERROR FOR NVIDIA GPUS
        stackIndex++
      } else { // otherwise we process startIndex and endIndex
        console.info('HERHEHREHRHEH')
        const t = exponentialInterpolation(inputVal, start, end, base)
        console.info('t', t)
        conditionStack[stackIndex] = startIndex
        tStack[stackIndex] = 1.0 - t
        stackIndex++
        conditionStack[stackIndex] = endIndex
        tStack[stackIndex] = t
        stackIndex++
        console.info('conditionStack', conditionStack)
        console.info('tStack', tStack)
        console.info('stackIndex', stackIndex)
      }
      // now that we got the information we need - we need to ensure we flush all feature subCondition data
      // hidden in zooms that we had to parse in the setup stage
      loopTotal = 0
      console.info('loop?', endIndex < len + startingOffset)
      while (endIndex < len + startingOffset) {
        console.info('endIndex < len + startingOffset', endIndex, len + startingOffset, endIndex < len + startingOffset)
        // if current sub condition is an input-range, we must check if if the "start"
        // subCondition was a data-condition or data-range, and if so,
        // we must move past the featureCode that was stored there
        subCondition = (layerCode[startIndex] & 1008) >> 4
        console.info('subCondition', subCondition)
        if (subCondition === 2 || subCondition === 4) { featureIndexPtr.ptr++ }
        indexPtr.ptr++
        indexPtr.ptr += layerCode[indexPtr.ptr] >> 10
        endIndex = indexPtr.ptr + 1
        loopTotal++
        if (loopTotal > 100) { console.info('FOUND'); break }
      }
    } else if (condition === 6) { // feature-state
      // iterate through subConditions until it matches "uFeatureState"
      // once found, inject
      res = [0.0, 0.0, 0.0, 1.0]
      return res
    } else if (condition === 7) { // animation-state

    }

    // continuing {
    //   // if our stackIndex is done or we went to far (bug) then we break
    //   break if (stackIndex <= 0 || stackIndex > 5)
    // }
    if (stackIndex <= 0 || stackIndex > 5) { break }
  }

  // update index to the next Layer property
  indexPtr.ptr = featureSize + decodeOffset
  console.info(indexPtr.ptr)

  // // if lch: convert back to rgb
  // if (color && layer.useLCH != 0.0) { res = LCH2RGB(res) }
  // // assuming user has selected a colorblind state, adjust accordingly
  // if (color && view.cBlind != 0.0) { res = cBlindAdjust(res) }

  return res
}

// TEST:
// [10320, 0, 2064, 14, 3, 2064, 22, 4, 2064, 24, 2064, 16, 5136, 0.10196078431372549, 0.45098039215686275, 0.9058823529411765, 1, 2064, 0.5, 5136, 1, 1, 1, 0.75]
const indexPtr = { ptr: 0 }
const featureIndexPtr = { ptr: 0 }
const size = decodeFeature(false, indexPtr, featureIndexPtr)[0]
// const iconSize = decodeFeature(false, indexPtr, featureIndexPtr)[0]
// const color = decodeFeature(true, indexPtr, featureIndexPtr)
// const strokeWidth = decodeFeature(false, indexPtr, featureIndexPtr)[0]
// const strokeColor = decodeFeature(true, indexPtr, featureIndexPtr)

console.info('size', size)
// console.info('iconSize', iconSize)
// console.info('color', color)
// console.info('strokeWidth', strokeWidth)
// console.info('strokeColor', strokeColor)

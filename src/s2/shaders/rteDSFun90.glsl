vec3 RTE (in vec3 posHigh, in vec3 posLow) {
  vec3 t1 = posLow - uEyePosLow;
  vec3 e = t1 - posLow;
  vec3 t2 = ((uEyePosLow - e) + (posLow - (t1 - e))) + posHigh - uEyePosHigh;
  vec3 highDifference = t1 + t2;
  vec3 lowDifference = t2 - (highDifference - t1);

  return highDifference - lowDifference;
}

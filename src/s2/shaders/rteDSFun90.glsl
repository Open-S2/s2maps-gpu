vec3 RTE () {
  vec3 t1 = aPosLow - uEyePosLow;
  vec3 e = t1 - aPosLow;
  vec3 t2 = ((uEyePosLow - e) + (aPosLow - (t1 - e))) + aPosHigh - uEyePosHigh;
  vec3 highDifference = t1 + t2;
  vec3 lowDifference = t2 - (highDifference - t1);

  return highDifference - lowDifference;
}

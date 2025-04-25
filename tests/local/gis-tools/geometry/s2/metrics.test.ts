import {
  K_AVG_ANGLE_SPAN,
  K_AVG_AREA,
  K_AVG_DIAG,
  K_AVG_EDGE,
  K_AVG_WIDTH,
  K_MAX_ANGLE_SPAN,
  K_MAX_AREA,
  K_MAX_DIAG,
  K_MAX_EDGE,
  K_MAX_WIDTH,
  K_MIN_ANGLE_SPAN,
  K_MIN_AREA,
  K_MIN_DIAG,
  K_MIN_EDGE,
  K_MIN_WIDTH,
} from '../../../../../s2/gis-tools/geometry/s2/metrics';
import { describe, expect, it } from 'vitest';

// ANGLE SPAN

describe('K_AVG_ANGLE_SPAN', () => {
  const kAvgAngleSpan = K_AVG_ANGLE_SPAN();
  it('getValue', () => {
    expect(kAvgAngleSpan.getValue(0)).toEqual(3.141592653589793);
    expect(kAvgAngleSpan.getValue(1)).toEqual(1.5707963267948966);
    expect(kAvgAngleSpan.getValue(2)).toEqual(0.7853981633974483);
    expect(kAvgAngleSpan.getValue(3)).toEqual(0.39269908169872414);
  });

  it('getClosestLevel', () => {
    expect(kAvgAngleSpan.getClosestLevel(0)).toEqual(30);
    expect(kAvgAngleSpan.getClosestLevel(1.5707963267948966)).toEqual(0);
    expect(kAvgAngleSpan.getClosestLevel(0.7853981633974483)).toEqual(1);
    expect(kAvgAngleSpan.getClosestLevel(0.77)).toEqual(1);
    expect(kAvgAngleSpan.getClosestLevel(0.44)).toEqual(2);
    expect(kAvgAngleSpan.getClosestLevel(0.39269908169872414)).toEqual(2);
    expect(kAvgAngleSpan.getClosestLevel(0.19634954084936207)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kAvgAngleSpan.getLevelForMaxValue(0)).toEqual(30);
    expect(kAvgAngleSpan.getLevelForMaxValue(1.5707963267948966)).toEqual(0);
    expect(kAvgAngleSpan.getLevelForMaxValue(0.7853981633974483)).toEqual(1);
    expect(kAvgAngleSpan.getLevelForMaxValue(0.77)).toEqual(2);
    expect(kAvgAngleSpan.getLevelForMaxValue(0.44)).toEqual(2);
    expect(kAvgAngleSpan.getLevelForMaxValue(0.39269908169872414)).toEqual(2);
    expect(kAvgAngleSpan.getLevelForMaxValue(0.19634954084936207)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kAvgAngleSpan.getLevelForMinValue(0)).toEqual(30);
    expect(kAvgAngleSpan.getLevelForMinValue(1.5707963267948966)).toEqual(0);
    expect(kAvgAngleSpan.getLevelForMinValue(0.7853981633974483)).toEqual(1);
    expect(kAvgAngleSpan.getLevelForMinValue(0.77)).toEqual(1);
    expect(kAvgAngleSpan.getLevelForMinValue(0.44)).toEqual(1);
    expect(kAvgAngleSpan.getLevelForMinValue(0.39269908169872414)).toEqual(2);
    expect(kAvgAngleSpan.getLevelForMinValue(0.19634954084936207)).toEqual(3);
  });
});

describe('K_MAX_ANGLE_SPAN', () => {
  const kMaxAngleSpan = K_MAX_ANGLE_SPAN();
  it('getValue', () => {
    expect(kMaxAngleSpan.getValue(0)).toEqual(3.409794358398436);
    expect(kMaxAngleSpan.getValue(1)).toEqual(1.704897179199218);
    expect(kMaxAngleSpan.getValue(2)).toEqual(0.852448589599609);
    expect(kMaxAngleSpan.getValue(3)).toEqual(0.4262242947998045);
  });

  it('getClosestLevel', () => {
    expect(kMaxAngleSpan.getClosestLevel(0)).toEqual(30);
    expect(kMaxAngleSpan.getClosestLevel(1.704897179199218)).toEqual(0);
    expect(kMaxAngleSpan.getClosestLevel(0.852448589599609)).toEqual(1);
    expect(kMaxAngleSpan.getClosestLevel(0.77)).toEqual(1);
    expect(kMaxAngleSpan.getClosestLevel(0.44)).toEqual(2);
    expect(kMaxAngleSpan.getClosestLevel(0.4262242947998045)).toEqual(2);
    expect(kMaxAngleSpan.getClosestLevel(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMaxAngleSpan.getLevelForMaxValue(0)).toEqual(30);
    expect(kMaxAngleSpan.getLevelForMaxValue(1.704897179199218)).toEqual(0);
    expect(kMaxAngleSpan.getLevelForMaxValue(0.852448589599609)).toEqual(1);
    expect(kMaxAngleSpan.getLevelForMaxValue(0.77)).toEqual(2);
    expect(kMaxAngleSpan.getLevelForMaxValue(0.44)).toEqual(2);
    expect(kMaxAngleSpan.getLevelForMaxValue(0.4262242947998045)).toEqual(2);
    expect(kMaxAngleSpan.getLevelForMaxValue(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMaxAngleSpan.getLevelForMinValue(0)).toEqual(30);
    expect(kMaxAngleSpan.getLevelForMinValue(1.704897179199218)).toEqual(0);
    expect(kMaxAngleSpan.getLevelForMinValue(0.852448589599609)).toEqual(1);
    expect(kMaxAngleSpan.getLevelForMinValue(0.77)).toEqual(1);
    expect(kMaxAngleSpan.getLevelForMinValue(0.44)).toEqual(1);
    expect(kMaxAngleSpan.getLevelForMinValue(0.4262242947998045)).toEqual(2);
    expect(kMaxAngleSpan.getLevelForMinValue(0.21311214739990225)).toEqual(3);
  });
});

describe('K_MIN_ANGLE_SPAN', () => {
  const kMinAreaSpan = K_MIN_ANGLE_SPAN();
  it('getValue', () => {
    expect(kMinAreaSpan.getValue(0)).toEqual(2.6666666666666665);
    expect(kMinAreaSpan.getValue(1)).toEqual(1.3333333333333333);
    expect(kMinAreaSpan.getValue(2)).toEqual(0.6666666666666666);
    expect(kMinAreaSpan.getValue(3)).toEqual(0.3333333333333333);
  });

  it('getClosestLevel', () => {
    expect(kMinAreaSpan.getClosestLevel(0)).toEqual(30);
    expect(kMinAreaSpan.getClosestLevel(1.3333333333333333)).toEqual(0);
    expect(kMinAreaSpan.getClosestLevel(0.6666666666666666)).toEqual(1);
    expect(kMinAreaSpan.getClosestLevel(0.6)).toEqual(1);
    expect(kMinAreaSpan.getClosestLevel(0.35)).toEqual(2);
    expect(kMinAreaSpan.getClosestLevel(0.3333333333333333)).toEqual(2);
    expect(kMinAreaSpan.getClosestLevel(0.16666666666666666)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMinAreaSpan.getLevelForMaxValue(0)).toEqual(30);
    expect(kMinAreaSpan.getLevelForMaxValue(1.3333333333333333)).toEqual(0);
    expect(kMinAreaSpan.getLevelForMaxValue(0.6666666666666666)).toEqual(1);
    expect(kMinAreaSpan.getLevelForMaxValue(0.6)).toEqual(2);
    expect(kMinAreaSpan.getLevelForMaxValue(0.35)).toEqual(2);
    expect(kMinAreaSpan.getLevelForMaxValue(0.3333333333333333)).toEqual(2);
    expect(kMinAreaSpan.getLevelForMaxValue(0.16666666666666666)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMinAreaSpan.getLevelForMinValue(0)).toEqual(30);
    expect(kMinAreaSpan.getLevelForMinValue(1.3333333333333333)).toEqual(0);
    expect(kMinAreaSpan.getLevelForMinValue(0.6666666666666666)).toEqual(1);
    expect(kMinAreaSpan.getLevelForMinValue(0.6)).toEqual(1);
    expect(kMinAreaSpan.getLevelForMinValue(0.35)).toEqual(1);
    expect(kMinAreaSpan.getLevelForMinValue(0.3333333333333333)).toEqual(2);
    expect(kMinAreaSpan.getLevelForMinValue(0.16666666666666666)).toEqual(3);
  });
});

// AREA

describe('K_AVG_AREA', () => {
  const kAvgArea = K_AVG_AREA();
  it('getValue', () => {
    expect(kAvgArea.getValue(0)).toEqual(4.1887902047863905);
    expect(kAvgArea.getValue(1)).toEqual(1.0471975511965976);
    expect(kAvgArea.getValue(2)).toEqual(0.2617993877991494);
    expect(kAvgArea.getValue(3)).toEqual(0.06544984694978735);
  });

  it('getClosestLevel', () => {
    expect(kAvgArea.getClosestLevel(0)).toEqual(30);
    expect(kAvgArea.getClosestLevel(2.0943951023931953)).toEqual(0);
    expect(kAvgArea.getClosestLevel(0.5235987755982988)).toEqual(1);
    expect(kAvgArea.getClosestLevel(0.5)).toEqual(1);
    expect(kAvgArea.getClosestLevel(0.15)).toEqual(2);
    expect(kAvgArea.getClosestLevel(0.1308996938995747)).toEqual(2);
    expect(kAvgArea.getClosestLevel(0.032724923474893676)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kAvgArea.getLevelForMaxValue(0)).toEqual(30);
    expect(kAvgArea.getLevelForMaxValue(2.0943951023931953)).toEqual(0);
    expect(kAvgArea.getLevelForMaxValue(0.5235987755982988)).toEqual(1);
    expect(kAvgArea.getLevelForMaxValue(0.5)).toEqual(2);
    expect(kAvgArea.getLevelForMaxValue(0.15)).toEqual(2);
    expect(kAvgArea.getLevelForMaxValue(0.1308996938995747)).toEqual(2);
    expect(kAvgArea.getLevelForMaxValue(0.032724923474893676)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kAvgArea.getLevelForMinValue(0)).toEqual(30);
    expect(kAvgArea.getLevelForMinValue(2.0943951023931953)).toEqual(0);
    expect(kAvgArea.getLevelForMinValue(0.5235987755982988)).toEqual(1);
    expect(kAvgArea.getLevelForMinValue(0.5)).toEqual(1);
    expect(kAvgArea.getLevelForMinValue(0.15)).toEqual(1);
    expect(kAvgArea.getLevelForMinValue(0.1308996938995747)).toEqual(2);
    expect(kAvgArea.getLevelForMinValue(0.032724923474893676)).toEqual(3);
  });
});

describe('K_MAX_AREA', () => {
  const kMaxArea = K_MAX_AREA();
  it('getValue', () => {
    expect(kMaxArea.getValue(0)).toEqual(5.271598513926323);
    expect(kMaxArea.getValue(1)).toEqual(1.3178996284815807);
    expect(kMaxArea.getValue(2)).toEqual(0.3294749071203952);
    expect(kMaxArea.getValue(3)).toEqual(0.0823687267800988);
  });

  it('getClosestLevel', () => {
    expect(kMaxArea.getClosestLevel(0)).toEqual(30);
    expect(kMaxArea.getClosestLevel(2.6357992569631614)).toEqual(0);
    expect(kMaxArea.getClosestLevel(0.6589498142407904)).toEqual(1);
    expect(kMaxArea.getClosestLevel(0.6)).toEqual(1);
    expect(kMaxArea.getClosestLevel(0.2)).toEqual(2);
    expect(kMaxArea.getClosestLevel(0.1647374535601976)).toEqual(2);
    expect(kMaxArea.getClosestLevel(0.0411843633900494)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMaxArea.getLevelForMaxValue(0)).toEqual(30);
    expect(kMaxArea.getLevelForMaxValue(2.6357992569631614)).toEqual(0);
    expect(kMaxArea.getLevelForMaxValue(0.6589498142407904)).toEqual(1);
    expect(kMaxArea.getLevelForMaxValue(0.6)).toEqual(2);
    expect(kMaxArea.getLevelForMaxValue(0.2)).toEqual(2);
    expect(kMaxArea.getLevelForMaxValue(0.1647374535601976)).toEqual(2);
    expect(kMaxArea.getLevelForMaxValue(0.0411843633900494)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMaxArea.getLevelForMinValue(0)).toEqual(30);
    expect(kMaxArea.getLevelForMinValue(2.6357992569631614)).toEqual(0);
    expect(kMaxArea.getLevelForMinValue(0.6589498142407904)).toEqual(1);
    expect(kMaxArea.getLevelForMinValue(0.6)).toEqual(1);
    expect(kMaxArea.getLevelForMinValue(0.2)).toEqual(1);
    expect(kMaxArea.getLevelForMinValue(0.1647374535601976)).toEqual(2);
    expect(kMaxArea.getLevelForMinValue(0.0411843633900494)).toEqual(3);
  });
});

describe('K_MIN_AREA', () => {
  const kMinArea = K_MIN_AREA();
  it('getValue', () => {
    expect(kMinArea.getValue(0)).toEqual(2.514157444218836);
    expect(kMinArea.getValue(1)).toEqual(0.628539361054709);
    expect(kMinArea.getValue(2)).toEqual(0.15713484026367724);
    expect(kMinArea.getValue(3)).toEqual(0.03928371006591931);
  });

  it('getClosestLevel', () => {
    expect(kMinArea.getClosestLevel(0)).toEqual(30);
    expect(kMinArea.getClosestLevel(1.257078722109418)).toEqual(0);
    expect(kMinArea.getClosestLevel(0.3142696805273545)).toEqual(1);
    expect(kMinArea.getClosestLevel(0.3)).toEqual(1);
    expect(kMinArea.getClosestLevel(0.09)).toEqual(2);
    expect(kMinArea.getClosestLevel(0.07856742013183862)).toEqual(2);
    expect(kMinArea.getClosestLevel(0.019641855032959656)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMinArea.getLevelForMaxValue(0)).toEqual(30);
    expect(kMinArea.getLevelForMaxValue(1.257078722109418)).toEqual(0);
    expect(kMinArea.getLevelForMaxValue(0.3142696805273545)).toEqual(1);
    expect(kMinArea.getLevelForMaxValue(0.3)).toEqual(2);
    expect(kMinArea.getLevelForMaxValue(0.09)).toEqual(2);
    expect(kMinArea.getLevelForMaxValue(0.07856742013183862)).toEqual(2);
    expect(kMinArea.getLevelForMaxValue(0.019641855032959656)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMinArea.getLevelForMinValue(0)).toEqual(30);
    expect(kMinArea.getLevelForMinValue(1.257078722109418)).toEqual(0);
    expect(kMinArea.getLevelForMinValue(0.3142696805273545)).toEqual(1);
    expect(kMinArea.getLevelForMinValue(0.3)).toEqual(1);
    expect(kMinArea.getLevelForMinValue(0.09)).toEqual(1);
    expect(kMinArea.getLevelForMinValue(0.07856742013183862)).toEqual(2);
    expect(kMinArea.getLevelForMinValue(0.019641855032959656)).toEqual(3);
  });
});

// DIAG

describe('K_AVG_DIAG', () => {
  const kAvgDiag = K_AVG_DIAG();
  it('getValue', () => {
    expect(kAvgDiag.getValue(0)).toEqual(4.120845477996942);
    expect(kAvgDiag.getValue(1)).toEqual(2.060422738998471);
    expect(kAvgDiag.getValue(2)).toEqual(1.0302113694992354);
    expect(kAvgDiag.getValue(3)).toEqual(0.5151056847496177);
  });

  it('getClosestLevel', () => {
    expect(kAvgDiag.getClosestLevel(0)).toEqual(30);
    expect(kAvgDiag.getClosestLevel(2.060422738998471)).toEqual(0);
    expect(kAvgDiag.getClosestLevel(1.0302113694992354)).toEqual(1);
    expect(kAvgDiag.getClosestLevel(1.01)).toEqual(1);
    expect(kAvgDiag.getClosestLevel(0.55)).toEqual(2);
    expect(kAvgDiag.getClosestLevel(0.5151056847496177)).toEqual(2);
    expect(kAvgDiag.getClosestLevel(0.25755284237480885)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kAvgDiag.getLevelForMaxValue(0)).toEqual(30);
    expect(kAvgDiag.getLevelForMaxValue(2.060422738998471)).toEqual(0);
    expect(kAvgDiag.getLevelForMaxValue(1.0302113694992354)).toEqual(1);
    expect(kAvgDiag.getLevelForMaxValue(1.01)).toEqual(2);
    expect(kAvgDiag.getLevelForMaxValue(0.55)).toEqual(2);
    expect(kAvgDiag.getLevelForMaxValue(0.5151056847496177)).toEqual(2);
    expect(kAvgDiag.getLevelForMaxValue(0.25755284237480885)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kAvgDiag.getLevelForMinValue(0)).toEqual(30);
    expect(kAvgDiag.getLevelForMinValue(2.060422738998471)).toEqual(0);
    expect(kAvgDiag.getLevelForMinValue(1.0302113694992354)).toEqual(1);
    expect(kAvgDiag.getLevelForMinValue(1.01)).toEqual(1);
    expect(kAvgDiag.getLevelForMinValue(0.55)).toEqual(1);
    expect(kAvgDiag.getLevelForMinValue(0.5151056847496177)).toEqual(2);
    expect(kAvgDiag.getLevelForMinValue(0.25755284237480885)).toEqual(3);
  });
});

describe('K_MAX_DIAG', () => {
  const kMaxDiag = K_MAX_DIAG();
  it('getValue', () => {
    expect(kMaxDiag.getValue(0)).toEqual(4.877309188868042);
    expect(kMaxDiag.getValue(1)).toEqual(2.438654594434021);
    expect(kMaxDiag.getValue(2)).toEqual(1.2193272972170106);
    expect(kMaxDiag.getValue(3)).toEqual(0.6096636486085053);
  });

  it('getClosestLevel', () => {
    expect(kMaxDiag.getClosestLevel(0)).toEqual(30);
    expect(kMaxDiag.getClosestLevel(2.438654594434021)).toEqual(0);
    expect(kMaxDiag.getClosestLevel(1.2193272972170106)).toEqual(1);
    expect(kMaxDiag.getClosestLevel(1.01)).toEqual(1);
    expect(kMaxDiag.getClosestLevel(0.61)).toEqual(2);
    expect(kMaxDiag.getClosestLevel(0.6096636486085053)).toEqual(2);
    expect(kMaxDiag.getClosestLevel(0.30483182430425265)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMaxDiag.getLevelForMaxValue(0)).toEqual(30);
    expect(kMaxDiag.getLevelForMaxValue(2.438654594434021)).toEqual(0);
    expect(kMaxDiag.getLevelForMaxValue(1.2193272972170106)).toEqual(1);
    expect(kMaxDiag.getLevelForMaxValue(1.01)).toEqual(2);
    expect(kMaxDiag.getLevelForMaxValue(0.61)).toEqual(2);
    expect(kMaxDiag.getLevelForMaxValue(0.6096636486085053)).toEqual(2);
    expect(kMaxDiag.getLevelForMaxValue(0.30483182430425265)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMaxDiag.getLevelForMinValue(0)).toEqual(30);
    expect(kMaxDiag.getLevelForMinValue(2.438654594434021)).toEqual(0);
    expect(kMaxDiag.getLevelForMinValue(1.2193272972170106)).toEqual(1);
    expect(kMaxDiag.getLevelForMinValue(1.01)).toEqual(1);
    expect(kMaxDiag.getLevelForMinValue(0.61)).toEqual(1);
    expect(kMaxDiag.getLevelForMinValue(0.6096636486085053)).toEqual(2);
    expect(kMaxDiag.getLevelForMinValue(0.30483182430425265)).toEqual(3);
  });
});

describe('K_MIN_DIAG', () => {
  const kMinDiag = K_MIN_DIAG();
  it('getValue', () => {
    expect(kMinDiag.getValue(0)).toEqual(2.514157444218836);
    expect(kMinDiag.getValue(1)).toEqual(1.257078722109418);
    expect(kMinDiag.getValue(2)).toEqual(0.628539361054709);
    expect(kMinDiag.getValue(3)).toEqual(0.3142696805273545);
  });

  it('getClosestLevel', () => {
    expect(kMinDiag.getClosestLevel(0)).toEqual(30);
    expect(kMinDiag.getClosestLevel(1.257078722109418)).toEqual(0);
    expect(kMinDiag.getClosestLevel(0.628539361054709)).toEqual(1);
    expect(kMinDiag.getClosestLevel(0.61)).toEqual(1);
    expect(kMinDiag.getClosestLevel(0.35)).toEqual(2);
    expect(kMinDiag.getClosestLevel(0.3142696805273545)).toEqual(2);
    expect(kMinDiag.getClosestLevel(0.15713484026367724)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMinDiag.getLevelForMaxValue(0)).toEqual(30);
    expect(kMinDiag.getLevelForMaxValue(1.257078722109418)).toEqual(0);
    expect(kMinDiag.getLevelForMaxValue(0.628539361054709)).toEqual(1);
    expect(kMinDiag.getLevelForMaxValue(0.61)).toEqual(2);
    expect(kMinDiag.getLevelForMaxValue(0.35)).toEqual(2);
    expect(kMinDiag.getLevelForMaxValue(0.3142696805273545)).toEqual(2);
    expect(kMinDiag.getLevelForMaxValue(0.15713484026367724)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMinDiag.getLevelForMinValue(0)).toEqual(30);
    expect(kMinDiag.getLevelForMinValue(1.257078722109418)).toEqual(0);
    expect(kMinDiag.getLevelForMinValue(0.628539361054709)).toEqual(1);
    expect(kMinDiag.getLevelForMinValue(0.61)).toEqual(1);
    expect(kMinDiag.getLevelForMinValue(0.35)).toEqual(1);
    expect(kMinDiag.getLevelForMinValue(0.3142696805273545)).toEqual(2);
    expect(kMinDiag.getLevelForMinValue(0.15713484026367724)).toEqual(3);
  });
});

// EDGE

describe('K_AVG_EDGE', () => {
  const kAvgEdge = K_AVG_EDGE();
  it('getValue', () => {
    expect(kAvgEdge.getValue(0)).toEqual(2.918427492772212);
    expect(kAvgEdge.getValue(1)).toEqual(1.459213746386106);
    expect(kAvgEdge.getValue(2)).toEqual(0.729606873193053);
    expect(kAvgEdge.getValue(3)).toEqual(0.3648034365965265);
  });

  it('getClosestLevel', () => {
    expect(kAvgEdge.getClosestLevel(0)).toEqual(30);
    expect(kAvgEdge.getClosestLevel(1.459213746386106)).toEqual(0);
    expect(kAvgEdge.getClosestLevel(0.729606873193053)).toEqual(1);
    expect(kAvgEdge.getClosestLevel(0.71)).toEqual(1);
    expect(kAvgEdge.getClosestLevel(0.38)).toEqual(2);
    expect(kAvgEdge.getClosestLevel(0.3648034365965265)).toEqual(2);
    expect(kAvgEdge.getClosestLevel(0.18240171829826324)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kAvgEdge.getLevelForMaxValue(0)).toEqual(30);
    expect(kAvgEdge.getLevelForMaxValue(1.459213746386106)).toEqual(0);
    expect(kAvgEdge.getLevelForMaxValue(0.729606873193053)).toEqual(1);
    expect(kAvgEdge.getLevelForMaxValue(0.71)).toEqual(2);
    expect(kAvgEdge.getLevelForMaxValue(0.38)).toEqual(2);
    expect(kAvgEdge.getLevelForMaxValue(0.3648034365965265)).toEqual(2);
    expect(kAvgEdge.getLevelForMaxValue(0.18240171829826324)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kAvgEdge.getLevelForMinValue(0)).toEqual(30);
    expect(kAvgEdge.getLevelForMinValue(1.459213746386106)).toEqual(0);
    expect(kAvgEdge.getLevelForMinValue(0.729606873193053)).toEqual(1);
    expect(kAvgEdge.getLevelForMinValue(0.71)).toEqual(1);
    expect(kAvgEdge.getLevelForMinValue(0.38)).toEqual(1);
    expect(kAvgEdge.getLevelForMinValue(0.3648034365965265)).toEqual(2);
    expect(kAvgEdge.getLevelForMinValue(0.18240171829826324)).toEqual(3);
  });
});

describe('K_MAX_EDGE', () => {
  const kMaxEdge = K_MAX_EDGE();
  it('getValue', () => {
    expect(kMaxEdge.getValue(0)).toEqual(3.409794358398436);
    expect(kMaxEdge.getValue(1)).toEqual(1.704897179199218);
    expect(kMaxEdge.getValue(2)).toEqual(0.852448589599609);
    expect(kMaxEdge.getValue(3)).toEqual(0.4262242947998045);
  });

  it('getClosestLevel', () => {
    expect(kMaxEdge.getClosestLevel(0)).toEqual(30);
    expect(kMaxEdge.getClosestLevel(1.704897179199218)).toEqual(0);
    expect(kMaxEdge.getClosestLevel(0.852448589599609)).toEqual(1);
    expect(kMaxEdge.getClosestLevel(0.84)).toEqual(1);
    expect(kMaxEdge.getClosestLevel(0.45)).toEqual(2);
    expect(kMaxEdge.getClosestLevel(0.4262242947998045)).toEqual(2);
    expect(kMaxEdge.getClosestLevel(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMaxEdge.getLevelForMaxValue(0)).toEqual(30);
    expect(kMaxEdge.getLevelForMaxValue(1.704897179199218)).toEqual(0);
    expect(kMaxEdge.getLevelForMaxValue(0.852448589599609)).toEqual(1);
    expect(kMaxEdge.getLevelForMaxValue(0.84)).toEqual(2);
    expect(kMaxEdge.getLevelForMaxValue(0.45)).toEqual(2);
    expect(kMaxEdge.getLevelForMaxValue(0.4262242947998045)).toEqual(2);
    expect(kMaxEdge.getLevelForMaxValue(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMaxEdge.getLevelForMinValue(0)).toEqual(30);
    expect(kMaxEdge.getLevelForMinValue(1.704897179199218)).toEqual(0);
    expect(kMaxEdge.getLevelForMinValue(0.852448589599609)).toEqual(1);
    expect(kMaxEdge.getLevelForMinValue(0.84)).toEqual(1);
    expect(kMaxEdge.getLevelForMinValue(0.45)).toEqual(1);
    expect(kMaxEdge.getLevelForMinValue(0.4262242947998045)).toEqual(2);
    expect(kMaxEdge.getLevelForMinValue(0.21311214739990225)).toEqual(3);
  });
});

describe('K_MIN_EDGE', () => {
  const kMinEdge = K_MIN_EDGE();
  it('getValue', () => {
    expect(kMinEdge.getValue(0)).toEqual(1.885618083164127);
    expect(kMinEdge.getValue(1)).toEqual(0.9428090415820635);
    expect(kMinEdge.getValue(2)).toEqual(0.47140452079103173);
    expect(kMinEdge.getValue(3)).toEqual(0.23570226039551587);
  });

  it('getClosestLevel', () => {
    expect(kMinEdge.getClosestLevel(0)).toEqual(30);
    expect(kMinEdge.getClosestLevel(0.9428090415820635)).toEqual(0);
    expect(kMinEdge.getClosestLevel(0.47140452079103173)).toEqual(1);
    expect(kMinEdge.getClosestLevel(0.45)).toEqual(1);
    expect(kMinEdge.getClosestLevel(0.25)).toEqual(2);
    expect(kMinEdge.getClosestLevel(0.23570226039551587)).toEqual(2);
    expect(kMinEdge.getClosestLevel(0.11785113019775793)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMinEdge.getLevelForMaxValue(0)).toEqual(30);
    expect(kMinEdge.getLevelForMaxValue(0.9428090415820635)).toEqual(0);
    expect(kMinEdge.getLevelForMaxValue(0.47140452079103173)).toEqual(1);
    expect(kMinEdge.getLevelForMaxValue(0.45)).toEqual(2);
    expect(kMinEdge.getLevelForMaxValue(0.25)).toEqual(2);
    expect(kMinEdge.getLevelForMaxValue(0.23570226039551587)).toEqual(2);
    expect(kMinEdge.getLevelForMaxValue(0.11785113019775793)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMinEdge.getLevelForMinValue(0)).toEqual(30);
    expect(kMinEdge.getLevelForMinValue(0.9428090415820635)).toEqual(0);
    expect(kMinEdge.getLevelForMinValue(0.47140452079103173)).toEqual(1);
    expect(kMinEdge.getLevelForMinValue(0.45)).toEqual(1);
    expect(kMinEdge.getLevelForMinValue(0.25)).toEqual(1);
    expect(kMinEdge.getLevelForMinValue(0.23570226039551587)).toEqual(2);
    expect(kMinEdge.getLevelForMinValue(0.11785113019775793)).toEqual(3);
  });
});

// WIDTH

describe('K_AVG_WIDTH', () => {
  const kAvgWidth = K_AVG_WIDTH();
  it('getValue', () => {
    expect(kAvgWidth.getValue(0)).toEqual(2.8690473457721986);
    expect(kAvgWidth.getValue(1)).toEqual(1.4345236728860993);
    expect(kAvgWidth.getValue(2)).toEqual(0.7172618364430496);
    expect(kAvgWidth.getValue(3)).toEqual(0.3586309182215248);
  });

  it('getClosestLevel', () => {
    expect(kAvgWidth.getClosestLevel(0)).toEqual(30);
    expect(kAvgWidth.getClosestLevel(1.4345236728860993)).toEqual(0);
    expect(kAvgWidth.getClosestLevel(0.7172618364430496)).toEqual(1);
    expect(kAvgWidth.getClosestLevel(0.71)).toEqual(1);
    expect(kAvgWidth.getClosestLevel(0.38)).toEqual(2);
    expect(kAvgWidth.getClosestLevel(0.3586309182215248)).toEqual(2);
    expect(kAvgWidth.getClosestLevel(0.1793154591107624)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kAvgWidth.getLevelForMaxValue(0)).toEqual(30);
    expect(kAvgWidth.getLevelForMaxValue(1.4345236728860993)).toEqual(0);
    expect(kAvgWidth.getLevelForMaxValue(0.7172618364430496)).toEqual(1);
    expect(kAvgWidth.getLevelForMaxValue(0.71)).toEqual(2);
    expect(kAvgWidth.getLevelForMaxValue(0.38)).toEqual(2);
    expect(kAvgWidth.getLevelForMaxValue(0.3586309182215248)).toEqual(2);
    expect(kAvgWidth.getLevelForMaxValue(0.1793154591107624)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kAvgWidth.getLevelForMinValue(0)).toEqual(30);
    expect(kAvgWidth.getLevelForMinValue(1.4345236728860993)).toEqual(0);
    expect(kAvgWidth.getLevelForMinValue(0.7172618364430496)).toEqual(1);
    expect(kAvgWidth.getLevelForMinValue(0.71)).toEqual(1);
    expect(kAvgWidth.getLevelForMinValue(0.38)).toEqual(1);
    expect(kAvgWidth.getLevelForMinValue(0.3586309182215248)).toEqual(2);
    expect(kAvgWidth.getLevelForMinValue(0.1793154591107624)).toEqual(3);
  });
});

describe('K_MAX_WIDTH', () => {
  const kMaxWidth = K_MAX_WIDTH();
  it('getValue', () => {
    expect(kMaxWidth.getValue(0)).toEqual(3.409794358398436);
    expect(kMaxWidth.getValue(1)).toEqual(1.704897179199218);
    expect(kMaxWidth.getValue(2)).toEqual(0.852448589599609);
    expect(kMaxWidth.getValue(3)).toEqual(0.4262242947998045);
  });

  it('getClosestLevel', () => {
    expect(kMaxWidth.getClosestLevel(0)).toEqual(30);
    expect(kMaxWidth.getClosestLevel(1.704897179199218)).toEqual(0);
    expect(kMaxWidth.getClosestLevel(0.852448589599609)).toEqual(1);
    expect(kMaxWidth.getClosestLevel(0.84)).toEqual(1);
    expect(kMaxWidth.getClosestLevel(0.45)).toEqual(2);
    expect(kMaxWidth.getClosestLevel(0.4262242947998045)).toEqual(2);
    expect(kMaxWidth.getClosestLevel(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMaxWidth.getLevelForMaxValue(0)).toEqual(30);
    expect(kMaxWidth.getLevelForMaxValue(1.704897179199218)).toEqual(0);
    expect(kMaxWidth.getLevelForMaxValue(0.852448589599609)).toEqual(1);
    expect(kMaxWidth.getLevelForMaxValue(0.84)).toEqual(2);
    expect(kMaxWidth.getLevelForMaxValue(0.45)).toEqual(2);
    expect(kMaxWidth.getLevelForMaxValue(0.4262242947998045)).toEqual(2);
    expect(kMaxWidth.getLevelForMaxValue(0.21311214739990225)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMaxWidth.getLevelForMinValue(0)).toEqual(30);
    expect(kMaxWidth.getLevelForMinValue(1.704897179199218)).toEqual(0);
    expect(kMaxWidth.getLevelForMinValue(0.852448589599609)).toEqual(1);
    expect(kMaxWidth.getLevelForMinValue(0.84)).toEqual(1);
    expect(kMaxWidth.getLevelForMinValue(0.45)).toEqual(1);
    expect(kMaxWidth.getLevelForMinValue(0.4262242947998045)).toEqual(2);
    expect(kMaxWidth.getLevelForMinValue(0.21311214739990225)).toEqual(3);
  });
});

describe('K_MIN_WIDTH', () => {
  const kMinWidth = K_MIN_WIDTH();
  it('getValue', () => {
    expect(kMinWidth.getValue(0)).toEqual(1.885618083164127);
    expect(kMinWidth.getValue(1)).toEqual(0.9428090415820635);
    expect(kMinWidth.getValue(2)).toEqual(0.47140452079103173);
    expect(kMinWidth.getValue(3)).toEqual(0.23570226039551587);
  });

  it('getClosestLevel', () => {
    expect(kMinWidth.getClosestLevel(0)).toEqual(30);
    expect(kMinWidth.getClosestLevel(0.9428090415820635)).toEqual(0);
    expect(kMinWidth.getClosestLevel(0.47140452079103173)).toEqual(1);
    expect(kMinWidth.getClosestLevel(0.45)).toEqual(1);
    expect(kMinWidth.getClosestLevel(0.25)).toEqual(2);
    expect(kMinWidth.getClosestLevel(0.23570226039551587)).toEqual(2);
    expect(kMinWidth.getClosestLevel(0.11785113019775793)).toEqual(3);
  });

  it('getLevelForMaxValue', () => {
    expect(kMinWidth.getLevelForMaxValue(0)).toEqual(30);
    expect(kMinWidth.getLevelForMaxValue(0.9428090415820635)).toEqual(0);
    expect(kMinWidth.getLevelForMaxValue(0.47140452079103173)).toEqual(1);
    expect(kMinWidth.getLevelForMaxValue(0.45)).toEqual(2);
    expect(kMinWidth.getLevelForMaxValue(0.25)).toEqual(2);
    expect(kMinWidth.getLevelForMaxValue(0.23570226039551587)).toEqual(2);
    expect(kMinWidth.getLevelForMaxValue(0.11785113019775793)).toEqual(3);
  });

  it('getLevelForMinValue', () => {
    expect(kMinWidth.getLevelForMinValue(0)).toEqual(30);
    expect(kMinWidth.getLevelForMinValue(0.9428090415820635)).toEqual(0);
    expect(kMinWidth.getLevelForMinValue(0.47140452079103173)).toEqual(1);
    expect(kMinWidth.getLevelForMinValue(0.45)).toEqual(1);
    expect(kMinWidth.getLevelForMinValue(0.25)).toEqual(1);
    expect(kMinWidth.getLevelForMinValue(0.23570226039551587)).toEqual(2);
    expect(kMinWidth.getLevelForMinValue(0.11785113019775793)).toEqual(3);
  });
});

const std = @import("std");
const testing = std.testing;
const math = std.math;
const pi = math.pi;
const atan2 = math.atan2;
const asin = math.asin;

// https://github.com/proj4js/proj4js/blob/master/lib/projections/ortho.js
const EPSLN = 1.0e-10;
const D2R = 0.01745329251994329577;
const R2D = 57.29577951308232088;

const CursorToLonLatError = error{
    InvalidRadius,
};

// centerLon and centerlat is where the center of the sphere is currently located
// x is the distance from center
pub fn cursorToLonLat(
    centerLon: f64,
    centerLat: f64,
    x: f64,
    y: f64,
    radius: f64,
) ![2]f64 {
    var cLon = centerLon;
    var cLat = centerLat;
    // pre adjust to radians
    cLon *= D2R;
    cLat *= D2R;
    // prep
    const rh = @sqrt(x * x + y * y);
    // corner case, the x+y is too far
    if (rh > radius) return CursorToLonLatError.InvalidRadius;
    const z = asinz(rh / radius);
    const sinP14 = @sin(cLat);
    const cosP14 = @cos(cLat);
    const sinz = @sin(z);
    const cosz = @cos(z);
    var lon = cLon;
    var lat = cLat;
    const con = @fabs(cLat) - (pi / 2.0);
    // corner case: basically on the dot center
    if (@fabs(rh) <= EPSLN) {
        return [2]f64{ lon * R2D, lat * R2D };
    }
    // build lat
    lat = asinz(cosz * sinP14 + (y * sinz * cosP14) / rh);
    // negative angles
    if (@fabs(con) <= EPSLN) {
        if (cLat >= 0) {
            lon = adjustLon(cLon + atan2(f64, x, -y));
        } else {
            lon = adjustLon(cLon - atan2(f64, -x, y));
        }
    } else { // positive angles
        lon = adjustLon(cLon + atan2(f64, (x * sinz), rh * cosP14 * cosz - y * sinP14 * sinz));
    }
    return [2]f64{ lon * R2D, lat * R2D };
}

fn asinz(x: f64) f64 {
    var xx = x;
    if (@fabs(x) > 1.0) {
        if (x > 1) xx = 1.0 else xx = -1.0;
    }
    return asin(xx);
}

fn adjustLon(x: f64) f64 {
    if (@fabs(x) <= 3.14159265359) {
        return x;
    }
    return x - (sign(x) * pi * 2.0);
}

fn sign(x: f64) f64 {
    if (x < 0) return -1.0;
    return 1.0;
}

test "cursorToLonLat" {
    // radius too large
    {
        const res = cursorToLonLat(0.0, 0.0, 1_000.0, 1_000.0, 1.0);
        try testing.expectError(CursorToLonLatError.InvalidRadius, res);
    }

    {
        const res = try cursorToLonLat(0.0, 0.0, 1.0, 1.0, 10.0);
        const expecting = [2]f64{ 5.768181186188223e+00, 5.739170477266786e+00 };
        try testing.expectEqual(expecting[0], res[0]);
        try testing.expectEqual(expecting[1], res[1]);
    }
}

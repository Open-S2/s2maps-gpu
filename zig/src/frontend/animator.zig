const std = @import("std");

pub const Easing = enum {
    Linear,
    EaseIn,
    EaseOut,
    EaseInOut,
};

pub const AnimationDirections = struct {
    lon: ?f64,
    lat: ?f64,
    zoom: ?f64,
    bearing: ?f64,
    pitch: ?f64,
    speed: f64 = 0.0,
    duration: f64 = 2.5,
    easing: Easing = Easing.Linear,
};

// export type AnimationType = 'easeTo' | 'flyTo'
const AnimationType = enum {
    EaseTo,
    FlyTo,
};

// export type IncrementResponse = [boolean, [number, number, number, number, number]]
const IncrementResponse = struct {
    ok: bool,
    values: [5]f64,
};

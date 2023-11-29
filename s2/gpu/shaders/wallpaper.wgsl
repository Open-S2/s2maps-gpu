struct ViewUniforms {
  cBlind: f32, // colorblind support
  zoom: f32, // exact zoom
  lon: f32,
  lat: f32,
  bearing: f32,
  pitch: f32,
  time: f32,
  aspectX: f32,
  aspectY: f32,
  featureState: f32,
  curFeature: f32,
  devicePixelRatio: f32,
};

struct WallpaperUniforms {
  fade1: vec4<f32>,
  fade2: vec4<f32>,
  halo: vec4<f32>,
  background: vec4<f32>,
  scale: vec2<f32>,
  padding: vec2<f32>,
}

struct VertexOutput {
  @builtin(position) Position: vec4<f32>,
  @location(0) screenPos: vec2<f32>,
  @location(1) fade1: vec4<f32>,
  @location(2) fade2: vec4<f32>,
  @location(3) halo: vec4<f32>,
  @location(4) background: vec4<f32>,
};

@binding(0) @group(0) var<uniform> view: ViewUniforms;
@binding(0) @group(1) var<uniform> uniforms: WallpaperUniforms;

const Inputs = array<vec2<f32>, 6>(
  vec2(-1., -1.),
  vec2(1., -1.),
  vec2(-1., 1.),
  vec2(1., -1.),
  vec2(1., 1.),
  vec2(-1., 1.)
);

// COLOR BLIND ADJUST:
// https://www.nature.com/articles/nmeth.1618
// http://www.daltonize.org/
// https://galactic.ink/labs/Color-Vision/Javascript/Color.Vision.Daltonize.js
fn cBlindAdjust (rgba: vec4<f32>) -> vec4<f32> {
  if (view.cBlind == 0.) { return rgba; } // no colorblindness
  // setup rgb
  var r = rgba.r * 255.;
  var g = rgba.g * 255.;
  var b = rgba.b * 255.;
  // if uCBlind is 4 return grayscale
  if (view.cBlind == 4.) {
    var l = (0.3 * r) + (0.59 * g) + (0.11 * b);
    return vec4<f32>(
      l / 255.,
      l / 255.,
      l / 255.,
      rgba.a
    );
  }
  // grab color conversion mode
  var CVD = array<f32, 9>();
  if (view.cBlind == 1.) { CVD = array<f32, 9>(0.0, 2.02344, -2.52581, 0., 1., 0., 0., 0., 1.); } // protanopia
  else if (view.cBlind == 2.) { CVD = array<f32, 9>(1.0, 0., 0., 0.494207, 0., 1.24827, 0., 0., 1.); } // deutranopia
  else { CVD = array<f32, 9>(1.0, 0., 0., 0., 1.0, 0., -0.395913, 0.801109, 0.); } // tritanopia
  // RGB to LMS matrix conversion
	var L = (17.8824 * r) + (43.5161 * g) + (4.11935 * b);
	var M = (3.45565 * r) + (27.1554 * g) + (3.86714 * b);
	var S = (0.0299566 * r) + (0.184309 * g) + (1.46709 * b);
	// Simulate color blindness
	var l = (CVD[0] * L) + (CVD[1] * M) + (CVD[2] * S);
	var m = (CVD[3] * L) + (CVD[4] * M) + (CVD[5] * S);
	var s = (CVD[6] * L) + (CVD[7] * M) + (CVD[8] * S);
	// LMS to RGB matrix conversion
	var R = (0.0809444479 * l) + (-0.130504409 * m) + (0.116721066 * s);
	var G = (-0.0102485335 * l) + (0.0540193266 * m) + (-0.113614708 * s);
	var B = (-0.000365296938 * l) + (-0.00412161469 * m) + (0.693511405 * s);
	// Isolate invisible colors to color vision deficiency (calculate error matrix)
	R = r - R;
	G = g - G;
	B = b - B;
	// Shift colors towards visible spectrum (apply error modifications)
	var GG = (0.7 * R) + (1.0 * G);
	var BB = (0.7 * R) + (1.0 * B);
	// Add compensation to original values, clamp to 0->255 range, rescope to 0->1 range.
  return vec4<f32>(
    clamp(r, 0., 255.) / 255.,
    clamp(GG + g, 0., 255.) / 255.,
    clamp(BB + b, 0., 255.) / 255.,
    rgba.a
  );
}

@vertex
fn vMain(
  @builtin(vertex_index) VertexIndex: u32,
) -> VertexOutput {
  var output: VertexOutput;
  output.Position = vec4<f32>(Inputs[VertexIndex], 1., 1.);
  output.screenPos = Inputs[VertexIndex];
  output.fade1 = cBlindAdjust(uniforms.fade1);
  output.fade2 = cBlindAdjust(uniforms.fade2);
  output.halo = cBlindAdjust(uniforms.halo);
  output.background = cBlindAdjust(uniforms.background);
  return output;
}

@fragment
fn fMain(
  output: VertexOutput
) -> @location(0) vec4<f32> {
  var pos = vec2<f32>(output.screenPos);
  pos *= 0.065 / uniforms.scale;

  var fade1 = length(pos);
  var fade2 = fade1;
  var haloSmooth = fade1;
  fade1 = smoothstep(0.15, 1., 1.0 - fade1);
  fade2 = smoothstep(0.55, 1., 1.0 - fade2);
  haloSmooth = smoothstep(0.77, 0.825, 1.0 - haloSmooth);

  var color = vec4<f32>(1.0);
	color = mix(output.background, output.fade1, fade1);
  color = mix(color, output.halo, haloSmooth);
  color = mix(color, output.fade2, fade2);

  return color;
}

// @flow
import type { Projector } from './projections'

export default class Path {
  projection: Projector
  constructor (projection: Projector) {
    this.projection = projection
  }

  flyTo () {

  }
}



flyTo(options: Object, eventData?: Object) {
  // Fall through to jumpTo if user has set prefers-reduced-motion
  if (!options.essential && browser.prefersReducedMotion) {
      const coercedOptions = (pick(options, ['center', 'zoom', 'bearing', 'pitch', 'around']): CameraOptions);
      return this.jumpTo(coercedOptions, eventData);
  }

  // This method implements an “optimal path” animation, as detailed in:
  //
  // Van Wijk, Jarke J.; Nuij, Wim A. A. “Smooth and efficient zooming and panning.” INFOVIS
  //   ’03. pp. 15–22. <https://www.win.tue.nl/~vanwijk/zoompan.pdf#page=5>.
  //
  // Where applicable, local variable documentation begins with the associated variable or
  // function in van Wijk (2003).

  this.stop();

  options = extend({
    offset: [0, 0],
    speed: 1.2,
    curve: 1.42,
    easing: defaultEasing
  }, options);

  const tr = this.transform,
    startZoom = this.getZoom(),
    startBearing = this.getBearing(),
    startPitch = this.getPitch(),
    startPadding = this.getPadding();

  const zoom = 'zoom' in options ? clamp(+options.zoom, tr.minZoom, tr.maxZoom) : startZoom;
  const bearing = 'bearing' in options ? this._normalizeBearing(options.bearing, startBearing) : startBearing;
  const pitch = 'pitch' in options ? +options.pitch : startPitch;
  const padding = 'padding' in options ? options.padding : tr.padding;

  const scale = tr.zoomScale(zoom - startZoom);
  const offsetAsPoint = Point.convert(options.offset);
  let pointAtOffset = tr.centerPoint.add(offsetAsPoint);
  const locationAtOffset = tr.pointLocation(pointAtOffset);
  const center = LngLat.convert(options.center || locationAtOffset);
  this._normalizeCenter(center);

  const from = tr.project(locationAtOffset);
  const delta = tr.project(center).sub(from);

  let rho = options.curve;

  // w₀: Initial visible span, measured in pixels at the initial scale.
  const w0 = Math.max(tr.width, tr.height),
    // w₁: Final visible span, measured in pixels with respect to the initial scale.
    w1 = w0 / scale,
    // Length of the flight path as projected onto the ground plane, measured in pixels from
    // the world image origin at the initial scale.
    u1 = delta.mag();

  if ('minZoom' in options) {
    const minZoom = clamp(Math.min(options.minZoom, startZoom, zoom), tr.minZoom, tr.maxZoom);
    // w<sub>m</sub>: Maximum visible span, measured in pixels with respect to the initial
    // scale.
    const wMax = w0 / tr.zoomScale(minZoom - startZoom);
    rho = Math.sqrt(wMax / u1 * 2);
  }

  // ρ²
  const rho2 = rho * rho;

  /**
   * rᵢ: Returns the zoom-out factor at one end of the animation.
   *
   * @param i 0 for the ascent or 1 for the descent.
   * @private
   */
  function r(i) {
    const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1);
    return Math.log(Math.sqrt(b * b + 1) - b);
  }

  function sinh(n) { return (Math.exp(n) - Math.exp(-n)) / 2; }
  function cosh(n) { return (Math.exp(n) + Math.exp(-n)) / 2; }
  function tanh(n) { return sinh(n) / cosh(n); }

  // r₀: Zoom-out factor during ascent.
  const r0 = r(0);

  // w(s): Returns the visible span on the ground, measured in pixels with respect to the
  // initial scale. Assumes an angular field of view of 2 arctan ½ ≈ 53°.
  let w: (_: number) => number = function (s) {
    return (cosh(r0) / cosh(r0 + rho * s));
  };

  // u(s): Returns the distance along the flight path as projected onto the ground plane,
  // measured in pixels from the world image origin at the initial scale.
  let u: (_: number) => number = function (s) {
    return w0 * ((cosh(r0) * tanh(r0 + rho * s) - sinh(r0)) / rho2) / u1;
  };

  // S: Total length of the flight path, measured in ρ-screenfuls.
  let S = (r(1) - r0) / rho;

  // When u₀ = u₁, the optimal path doesn’t require both ascent and descent.
  if (Math.abs(u1) < 0.000001 || !isFinite(S)) {
    // Perform a more or less instantaneous transition if the path is too short.
    if (Math.abs(w0 - w1) < 0.000001) return this.easeTo(options, eventData);

    const k = w1 < w0 ? -1 : 1;
    S = Math.abs(Math.log(w1 / w0)) / rho;

    u = function() { return 0; };
    w = function(s) { return Math.exp(k * rho * s); };
  }

  if ('duration' in options) {
    options.duration = +options.duration;
  } else {
    const V = 'screenSpeed' in options ? +options.screenSpeed / rho : +options.speed;
    options.duration = 1000 * S / V;
  }

  if (options.maxDuration && options.duration > options.maxDuration) {
    options.duration = 0;
  }

  this._zooming = true;
  this._rotating = (startBearing !== bearing);
  this._pitching = (pitch !== startPitch);
  this._padding = !tr.isPaddingEqual(padding);

  this._prepareEase(eventData, false);

  this._ease((k) => {
    // s: The distance traveled along the flight path, measured in ρ-screenfuls.
    const s = k * S;
    const scale = 1 / w(s);
    tr.zoom = k === 1 ? zoom : startZoom + tr.scaleZoom(scale);

    if (this._rotating) {
        tr.bearing = interpolate(startBearing, bearing, k);
    }
    if (this._pitching) {
        tr.pitch = interpolate(startPitch, pitch, k);
    }
    if (this._padding) {
        tr.interpolatePadding(startPadding, padding, k);
        // When padding is being applied, Transform#centerPoint is changing continuously,
        // thus we need to recalculate offsetPoint every frame
        pointAtOffset = tr.centerPoint.add(offsetAsPoint);
    }

    const newCenter = k === 1 ? center : tr.unproject(from.add(delta.mult(u(s))).mult(scale));
    tr.setLocationAtPoint(tr.renderWorldCopies ? newCenter.wrap() : newCenter, pointAtOffset);
    tr._updateCenterElevation();

    this._fireMoveEvents(eventData);
  }, () => this._afterEase(eventData), options);

  return this;
}

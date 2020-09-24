// Note in these scripts, I generally use lat/lon for lati­tude/longi­tude in degrees,
// and φ/λ for lati­tude/longi­tude in radians – having found that mixing degrees &
// radians is often the easiest route to head-scratching bugs...
function haversine (lon1, lat1, lon2, lat2) {
  /** DISTANCE **/
  const R = 1 // metres
  const φ1 = degToRad(lat1)
  const φ2 = degToRad(lat2)
  const λ1 = degToRad(lon1)
  const λ2 = degToRad(lon2)
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const d = R * c // in metres
  /** DISTANCE **/

  /** BEARING **/
  const y = Math.sin(λ2 - λ1) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(λ2 - λ1)
  const θ = Math.atan2(y, x)
  const brng = (θ * 180 / Math.PI + 360) % 360 // in degrees
  /** BEARING **/

  /** MIDPOINT **/
  const Bx = Math.cos(φ2) * Math.cos(λ2 - λ1)
  const By = Math.cos(φ2) * Math.sin(λ2 - λ1)
  const φ3 = Math.atan2(
    Math.sin(φ1) + Math.sin(φ2),
    Math.sqrt((Math.cos(φ1) + Bx) * (Math.cos(φ1) + Bx) + By * By)
  )
  const λ3 = λ1 + Math.atan2(By, Math.cos(φ1) + Bx)
  /** MIDPOINT **/

  return { d, θ, brng, mid: [radToDeg(λ3), radToDeg(φ3)] }
}

function intermediatePointTo (lon1, lat1, lon2, lat2, fraction) {
  // if (this.equals(point)) return new LatLonSpherical(this.lat, this.lon); // coincident points
  const λ1 = degToRad(lon1)
  const λ2 = degToRad(lon2)
  const φ1 = degToRad(lat1)
  const φ2 = degToRad(lat2)

  // haversine: distance between points
  const Δλ = λ2 - λ1
  const Δφ = φ2 - φ1
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
  const δ = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

  const A = Math.sin((1 - fraction) * δ) / Math.sin(δ)
  const B = Math.sin(fraction * δ) / Math.sin(δ)

  const x = A * Math.cos(φ1) * Math.cos(λ1) + B * Math.cos(φ2) * Math.cos(λ2)
  const y = A * Math.cos(φ1) * Math.sin(λ1) + B * Math.cos(φ2) * Math.sin(λ2)
  const z = A * Math.sin(φ1) + B * Math.sin(φ2)

  const λ3 = Math.atan2(y, x)
  const φ3 = Math.atan2(z, Math.sqrt(x * x + y * y))

  const lon = radToDeg(λ3)
  const lat = radToDeg(φ3)

  return [lon, lat]
}

function degToRad (deg) {
  return deg * Math.PI / 180
}

function radToDeg (rad) {
  return rad * 180 / Math.PI
}

const lon1 = 0
const lat1 = 0
const lon2 = 179.99
const lat2 = 0

let prev

// function getIncrement (incr) {
//   console.log(incr)
//   const [lon3, lat3] = intermediatePointTo(lon1, lat1, lon2, lat2, incr)
//   console.log(lon3, lat3)
//   const h = haversine(lon3, lat3, lon2, lat2)
//   console.log(h.d, h.brng)
//   if (incr !== 0) {
//     console.log('diff', prev - h.d)
//   }
//   prev = h.d
//   console.log()
// }
//
// for (let i = 0; i <= 10; i++) {
//   const incr = i / 10
//   getIncrement(incr)
// }

const degChangePerFrame = degToRad(6) // this value assumes zoom 0
const zoomDeltaPerSecond = 1.5
let artificialZoom = zoom = 6
let endZoom = 6
let fraction = 0
let deltaTime = 1 / 60 // assuming 60fps
let count = 0

const dist = haversine(lon1, lat1, lon2, lat2).d
// console.log('dist', dist)

// let curLon = lon1
// let curLat = lat1

while (true) {
  // const dist = haversine(curLon, curLat, lon2, lat2)
  // console.log('dist', dist)
  // the idea here is that we are
  const maxRadDelta = degChangePerFrame / Math.pow(2, Math.max(zoom, 0))
  const radPercentage = maxRadDelta / dist
  // console.log('radPercentage', maxRadDelta, dist, radPercentage)
  fraction = Math.min(1, fraction + radPercentage)
  if (fraction === 1 && zoom === endZoom) {
    const inter = intermediatePointTo(lon1, lat1, lon2, lat2, fraction)
    console.log('COMPLETE', count, count / 60, zoom, inter)
    break
  } else if (fraction !== 1) { // still need to move toward our target
    // console.log('fraction', fraction)
    count++
    const inter = intermediatePointTo(lon1, lat1, lon2, lat2, fraction)
    console.log(inter)
    if (fraction >= 0.66) {
      artificialZoom += zoomDeltaPerSecond * deltaTime
      artificialZoom = Math.min(endZoom, artificialZoom)
      zoom = Math.max(0, artificialZoom)
    } else {
      artificialZoom -= zoomDeltaPerSecond * deltaTime
      zoom = Math.max(0, artificialZoom) // assuming 60fps, we will see ~0.0833 zoom change per frame
    }
    // console.log(zoom, artificialZoom, inter)
  } else { // we still need to zoom
    count++
    // console.log('zooming', zoom)
    if (artificialZoom < 0) artificialZoom = 0
    artificialZoom += zoomDeltaPerSecond * deltaTime
    zoom = Math.min(endZoom, artificialZoom)
  }
}

// First HALF: zoom out




// console.time('haversine')
// const hav = haversine(lon1, lat1, lon2, lat2)
// console.timeEnd('haversine')
// console.time('intermediatePointTo')
// const inter = intermediatePointTo(lon1, lat1, lon2, lat2, 0)
// console.timeEnd('intermediatePointTo')
//
// console.log(hav)
// console.log(inter)


function wrap180 (degrees) {
  if (-180<degrees && degrees<=180) return degrees; // avoid rounding due to arithmetic ops if within range
  return (degrees+540)%360-180; // sawtooth wave p:180, a:±180
}

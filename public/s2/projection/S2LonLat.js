// @flow
/** COMPONENTS **/
import { xyzToLonLat } from './'
import S2Point from './S2Point'

export default class S2LonLat {
  lon: number
  lat: number
  constructor (lon: number, lat: number) { // represented in degrees
    this.lon = lon
    this.lat = lat
  }

  clone () {
    return new S2LonLat(this.lon, this.lat)
  }

  normalize () {
    while (this.lon < -180) this.lon += 360
    while (this.lon > 180) this.lon -= 360
    while (this.lat < -90) this.lat += 180
    while (this.lat > 90) this.lat -= 180
  }

  static fromS2Point (point: S2Point): S2LonLat {
    // convert the unit vector to lon lat
    const [lon, lat] = xyzToLonLat(point.x, point.y, point.z)
    // create the LonLat pair
    return new S2LonLat(lon, lat)
  }

  static fromXYZ (x: number, y: number, z: number): S2LonLat {
    // convert the unit vector to lon lat
    const [lon, lat] = xyzToLonLat(x, y, z)
    // create the LonLat pair
    return new S2LonLat(lon, lat)
  }
}

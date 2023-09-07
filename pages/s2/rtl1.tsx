import Map from '../../components/s2map'
import style from '../../components/rtl.json'
import MapProvider from '../../context/s2mapGPU'

function ready (s2map: S2Map): void {
  setTimeout(() => {
    s2map.flyTo({
      lon: 120.861409,
      lat: 31.276762,
      zoom: 9.5,
      duration: 5
    })
  }, 3000)
}

function Skeleton() {
  return (
    <MapProvider>
      <Map style={style as any} ready={ready} />
    </MapProvider>
  )
}

export default Skeleton

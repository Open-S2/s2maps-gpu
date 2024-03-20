import S2MapsGPU from './lib/S2MapsGPU'
import style from './assets/style'
import './App.css'

import type { MapOptions } from 's2maps-gpu'

const mapOptions: MapOptions = { style }

function App() {
  return <S2MapsGPU version="0.13.0" mapOptions={mapOptions} />
}

export default App

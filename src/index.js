import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import './index.css'
import './s2maps.css'

import * as serviceWorker from './serviceWorker'

const Home = lazy(() => import('./App/Home'))
const DEM = lazy(() => import('./App/DEM'))
const Raster = lazy(() => import('./App/Raster'))
const Mars = lazy(() => import('./App/Mars'))
const Streets = lazy(() => import('./App/Streets'))
const StreetsTest = lazy(() => import('./App/StreetsTest'))
const StreetsTestWebGPU = lazy(() => import('./App/StreetsTestWebGPU'))
const Light = lazy(() => import('./App/Light'))
const Coffee = lazy(() => import('./App/Coffee'))
const Soft = lazy(() => import('./App/Soft'))
const Dark = lazy(() => import('./App/Dark'))
const Outdoor = lazy(() => import('./App/Outdoor'))
const GeoJSON = lazy(() => import('./App/GeoJSON'))
const ColorBlind = lazy(() => import('./App/ColorBlind'))
const Hover = lazy(() => import('./App/Hover'))
const Invert = lazy(() => import('./App/Invert'))
const Tiles = lazy(() => import('./App/Tiles'))
const Tesla = lazy(() => import('./App/Tesla'))
const Moon = lazy(() => import('./App/Moon'))
const Starlink = lazy(() => import('./App/Starlink'))
const OAD = lazy(() => import('./App/OpenAddressData'))
const Earthquakes = lazy(() => import('./App/Earthquakes'))
const TissotsIndicatrix = lazy(() => import('./App/TissotsIndicatrix'))
const Studio = lazy(() => import('./App/Studio'))

ReactDOM.render(
  <Router>
    <Suspense fallback={<div />}>
      <Switch>
        <Route exact path='/' component={Home} />
        <Route path='/dem' component={DEM} />
        <Route path='/raster' component={Raster} />
        <Route path='/mars' component={Mars} />
        <Route path='/moon' component={Moon} />
        <Route path='/streets' component={Streets} />
        <Route path='/streets-test' component={StreetsTest} />
        <Route path='/streets-test-webgpu' component={StreetsTestWebGPU} />
        <Route path='/soft' component={Soft} />
        <Route path='/light' component={Light} />
        <Route path='/coffee' component={Coffee} />
        <Route path='/dark' component={Dark} />
        <Route path='/outdoor' component={Outdoor} />
        <Route path='/geojson' component={GeoJSON} />
        <Route path='/tissots' component={TissotsIndicatrix} />
        <Route path='/colorblind' component={ColorBlind} />
        <Route path='/hover' component={Hover} />
        <Route path='/invert' component={Invert} />
        <Route path='/tiles' component={Tiles} />
        <Route path='/earthquakes' component={Earthquakes} />
        <Route path='/tesla' component={Tesla} />
        <Route path='/starlink' component={Starlink} />
        <Route path='/open-address-data' component={OAD} />
        <Route path='/studio' component={Studio} />
      </Switch>
    </Suspense>
  </Router>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.register()

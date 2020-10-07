import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom'

import './index.css'

import * as serviceWorker from './serviceWorker'

const Home = lazy(() => import('./App/Home'))
const DEM = lazy(() => import('./App/DEM'))
const Raster = lazy(() => import('./App/Raster'))
const Streets = lazy(() => import('./App/Streets'))
const Light = lazy(() => import('./App/Light'))
const Dark = lazy(() => import('./App/Dark'))
const GeoJSON = lazy(() => import('./App/GeoJSON'))
const ColorBlind = lazy(() => import('./App/ColorBlind'))
const Hover = lazy(() => import('./App/Hover'))

ReactDOM.render(
  <Router>
    <Suspense fallback={<div />}>
      <Switch>
        <Route exact path='/' component={Home} />
        <Route path='/dem' component={DEM} />
        <Route path='/raster' component={Raster} />
        <Route path='/streets' component={Streets} />
        <Route path='/light' component={Light} />
        <Route path='/dark' component={Dark} />
        <Route path='/geojson' component={GeoJSON} />
        <Route path='/colorblind' component={ColorBlind} />
        <Route path='/hover' component={Hover} />
      </Switch>
    </Suspense>
  </Router>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.register()

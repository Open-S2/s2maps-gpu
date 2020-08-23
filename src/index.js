import React from 'react'
import ReactDOM from 'react-dom'
import { BrowserRouter, Route } from 'react-router-dom'
import './index.css'
import { Home, DEM, Raster, Streets } from './App/index'
import * as serviceWorker from './serviceWorker'

ReactDOM.render(
  <BrowserRouter>
    <Route exact path="/" component={Home} />
    <Route exact path="/dem" component={DEM} />
    <Route exact path="/raster" component={Raster} />
    <Route exact path="/streets" component={Streets} />
  </BrowserRouter>,
  document.getElementById('root')
)

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister()

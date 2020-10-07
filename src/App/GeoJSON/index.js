import React from 'react'
import Map from '../map'
import style from './style.json'

import './geojson.css'

function GeoJSON () {
  return <div>
    <Map style={style} />
    <div id="legend-container">
      <div id="legend-header">US Covid 2019 Confirmed Cases</div>
      <div id="legend-choropleth">
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">0 - 341</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">341 - 1015</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">1015 - 2000</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">2000 - 3174</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">3174 - 5911</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">5911 - 13319</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">13319 - 28804</div>
        </div>
        <div className="choropleth-container">
          <div className="choropleth-color" />
          <div className="choropleth-explain">28804+</div>
        </div>
      </div>
    </div>
  </div>
}

export default GeoJSON

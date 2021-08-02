import React from 'react'
import { Link } from 'react-router-dom'
import S2Logo from './S2Logo.svg'
import StreetsJPG from './streets.jpg'
import DarkJPG from './dark.jpg'
import LightJPG from './light.jpg'
import RasterJPG from './raster.jpg'
import MoonJPG from './moon.jpg'
import GeoJSONJPG from './geojson.jpg'
import HeatmapJPG from './heatmap.jpg'
import PointsJPG from './points.jpg'
import InteractJPG from './interact.jpg'
import TissotsJPG from './tissots.jpg'
import OutdoorJPG from './outdoor.jpg'
import InvertJPG from './invert.jpg'

function Home () {
  return (
    <main id='maincontent'>
      <div className='Home'>

        <div className='banner'>
          <img async loading='lazy' id='s2-logo' alt='logo' src={S2Logo} />
        </div>

        <div className='navigation-container'>

          <Link to='/streets'>
            <div className='link-container'>
              <img async loading='lazy' width='640px' height='363px' alt='streets' src={StreetsJPG} />
              <div className='link-name'>Streets</div>
            </div>
          </Link>

          <Link to='/dark'>
            <div className='link-container'>
              <img async loading='lazy' width='640px' height='363px' alt='dark' src={DarkJPG} />
              <div className='link-name'>Dark</div>
            </div>
          </Link>

          <Link to='/light'>
            <div className='link-container'>
              <img async loading='lazy' width='640px' height='363px' alt='light' src={LightJPG} />
              <div className='link-name'>Light</div>
            </div>
          </Link>

          <Link to='/outdoor'>
            <div className='link-container'>
              <img async loading='lazy' width='640px' height='363px' alt='outdoor' src={OutdoorJPG} />
              <div className='link-name'>Outdoor</div>
            </div>
          </Link>

          <Link to='/raster' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='raster' src={RasterJPG} />
            <div className='link-name'>Raster</div>
          </Link>

          <Link to='/moon' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='moon' src={MoonJPG} />
            <div className='link-name'>Moon</div>
          </Link>

          <Link to='/geojson' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='geojson' src={GeoJSONJPG} />
            <div className='link-name'>GeoJSON</div>
          </Link>

          <Link to='/invert' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='invert' src={InvertJPG} />
            <div className='link-name'>Invert Data</div>
          </Link>

          <Link to='/earthquakes' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='earthquakes' src={HeatmapJPG} />
            <div className='link-name'>Heatmap</div>
          </Link>

          <Link to='/open-address-data' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='open-address-data' src={PointsJPG} />
            <div className='link-name'>Point Data</div>
          </Link>

          <Link to='/tesla' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='tesla' src={InteractJPG} />
            <div className='link-name'>Interactive Data</div>
          </Link>

          <Link to='/tissots' className='link-container'>
            <img async loading='lazy' width='640px' height='363px' alt='tissots' src={TissotsJPG} />
            <div className='link-name'>Tissot's Indicatrix</div>
          </Link>

        </div>

      </div>
    </main>
  )
}

export default Home

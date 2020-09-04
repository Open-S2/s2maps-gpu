import React from 'react'
import { Link } from 'react-router-dom'
import S2Logo from './S2Logo'
import Streets from './streets.webp'
import Light from './light.webp'
import Raster from './raster.webp'
import DEM from './dem.mp4'

function Home () {
  return (
    <main id="maincontent">
      <div className="Home">

        <div className="banner">
          <S2Logo async />
        </div>

        <div className="warning-container">
          <div className="warn"><span className="warn-img" role="img" aria-label="Warn">⚠️</span> Notice: Vector maps sometimes render poorly on iOS devices. Refreshing the page sometimes fixes rendering errors. <span className="warn-img" role="img" aria-label="Warn">⚠️</span></div>
        </div>

        <div className="navigation-container">
          <Link to="/streets">
            <div className="link-container">
              <img async className="link-image lazyload" src={Streets} alt="streets" />
              <div className="link-name">Streets</div>
            </div>
          </Link>
          <Link to="/light">
            <div className="link-container">
              <img async className="link-image lazyload" src={Light} alt="light" />
              <div className="link-name">Light</div>
            </div>
          </Link>
          <Link to="/raster" className="link-container">
            <img async className="link-image lazyload" src={Raster} alt="raster" />
            <div className="link-name">Raster</div>
          </Link>
          <Link to="/dem" className="link-container">
            <video async className="link-video lazyload" autoPlay loop autobuffer="true" muted playsInline>
              <source src={DEM} type="video/mp4" />
            </video>
            <div className="link-name">DEM</div>
          </Link>
        </div>

      </div>
    </main>
  )
}

export default Home

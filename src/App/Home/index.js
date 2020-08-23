import React from 'react'
import { Link } from 'react-router-dom'
import Logo from './logo_alpha.jpg'
import Streets from './streets.jpg'
import Raster from './raster.jpg'
import DEM from './dem.mp4'

function Home () {
  return (
    <div className="Home">

      <div className="banner">
        <img id="s2-logo" src={Logo} alt="S2 Logo" width="500px" />
      </div>

      <div className="warning-container">
        <div className="warn"><span className="warn-img" role="img" aria-label="Warn">⚠️</span> Notice: Android devices are yet to be supported until I get my hands on an android phone. <span className="warn-img" role="img" aria-label="Warn">⚠️</span></div>
        <div className="warn"><span className="warn-img" role="img" aria-label="Warn">⚠️</span> Notice: Streets vector data is not entirely uploaded to date. Anything past zoom 10 is not guaranteed. This message will be removed when all data has been uploaded. <span className="warn-img" role="img" aria-label="Warn">⚠️</span></div>
      </div>

      <div className="navigation-container">
        <Link to="/streets">
          <div className="link-container">
            <img className="link-image" src={Streets} alt="streets" />
            <div className="link-name">Streets</div>
          </div>
        </Link>
        <Link to="/raster" className="link-container">
          <img className="link-image" src={Raster} alt="raster" />
          <div className="link-name">Raster</div>
        </Link>
        <Link to="/dem" className="link-container">
          <video className="link-video" autoPlay loop autobuffer="true" muted playsInline>
            <source src={DEM} type="video/mp4" />
          </video>
          <div className="link-name">DEM</div>
        </Link>
      </div>

    </div>
  )
}

export default Home

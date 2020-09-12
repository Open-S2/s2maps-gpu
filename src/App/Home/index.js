import React from 'react'
import { Link } from 'react-router-dom'
import S2Logo from './S2Logo.svg'
import StreetsWEBP from './streets2.webp'
import StreetsJPG from './streets2.jpg'
import LightWEBP from './light2.webp'
import LightJPG from './light2.jpg'
import RasterWEBP from './raster.webp'
import RasterJPG from './raster.jpg'
import DEM from './dem.mp4'

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
              <picture>
                <source async loading='lazy' width='640px' height='363px' alt='streets' srcSet={StreetsWEBP} type='image/webp' />
                <source async loading='lazy' width='640px' height='363px' alt='streets' srcSet={StreetsJPG} type='image/jpeg' />
                <img async loading='lazy' width='640px' height='363px' alt='streets' src={LightJPG} />
              </picture>
              <div className='link-name'>Streets</div>
            </div>
          </Link>

          <Link to='/light'>
            <div className='link-container'>
              <picture>
                <source async loading='lazy' width='640px' height='363px' alt='light' srcSet={LightWEBP} type='image/webp' />
                <source async loading='lazy' width='640px' height='363px' alt='light' srcSet={LightJPG} type='image/jpeg' />
                <img async loading='lazy' width='640px' height='363px' alt='light' src={LightJPG} />
              </picture>
              <div className='link-name'>Light</div>
            </div>
          </Link>

          <Link to='/raster' className='link-container'>
            <picture>
              <source async loading='lazy' width='640px' height='329px' alt='raster' srcSet={RasterWEBP} type='image/webp' />
              <source async loading='lazy' width='640px' height='329px' alt='raster' srcSet={RasterJPG} type='image/jpeg' />
              <img async loading='lazy' width='640px' height='329px' alt='raster' src={RasterJPG} />
            </picture>
            <div className='link-name'>Raster</div>
          </Link>

          <Link to='/dem' className='link-container'>
            <video async className='link-video' autoPlay loop autobuffer='true' muted playsInline>
              <source loading='lazy' src={DEM} type='video/mp4' />
            </video>
            <div className='link-name'>DEM</div>
          </Link>

        </div>

      </div>
    </main>
  )
}

export default Home

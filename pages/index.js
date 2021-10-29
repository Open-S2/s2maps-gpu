/* MODULES */
import Head from 'next/head'
// import Image from 'next/image'
import Link from 'next/link'
/* STYLES */
import styles from '../styles/home.module.css'

export default function Home () {
  return (
    <div className={styles.container}>
      <Head>
        <title>S2 Maps Demo</title>
        <meta name='description' content='S2 Maps Demo page' />
        <link rel='icon' href='/favicon.ico' />
      </Head>

      <main className={styles.main}>
        <div className={styles.Home}>

          <div className={styles.banner}>
            <img src='/images/home/S2Logo.svg' width={500} height={182} id={styles.s2Logo} alt='jolly-roger' />
          </div>

          <div className={styles.navigationContainer}>

            <Link href='/streets' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='streets' src='/images/home/streets.png' />
                <div className={styles.linkName}>Streets</div>
              </div>
            </Link>

            <Link href='/dark' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='dark' src='/images/home/dark.png' />
                <div className={styles.linkName}>Dark</div>
              </div>
            </Link>

            <Link href='/light' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='light' src='/images/home/light.png' />
                <div className={styles.linkName}>Light</div>
              </div>
            </Link>

            <Link href='/outdoor' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='outdoor' src='/images/home/outdoor.png' />
                <div className={styles.linkName}>Outdoor</div>
              </div>
            </Link>

            <Link href='/raster' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='raster' src='/images/home/raster.png' />
                <div className={styles.linkName}>Raster</div>
              </div>
            </Link>

            <Link href='/moon' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='moon' src='/images/home/moon.png' />
                <div className={styles.linkName}>Moon</div>
              </div>
            </Link>

            <Link href='/geojson' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='geojson' src='/images/home/geojson.png' />
                <div className={styles.linkName}>GeoJSON</div>
              </div>
            </Link>

            <Link href='/invert' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='invert' src='/images/home/invert.png' />
                <div className={styles.linkName}>Invert Data</div>
              </div>
            </Link>

            <Link href='/heatmap' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='heatmap' src='/images/home/heatmap.png' />
                <div className={styles.linkName}>Heatmap</div>
              </div>
            </Link>

            <Link href='/points' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='points' src='/images/home/points.png' />
                <div className={styles.linkName}>Point Data</div>
              </div>
            </Link>

            <Link href='/range' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='range' src='/images/home/range.png' />
                <div className={styles.linkName}>Range Data</div>
              </div>
            </Link>

            <Link href='/interact' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='interactive' src='/images/home/interact.png' />
                <div className={styles.linkName}>Interactive Data</div>
              </div>
            </Link>

            <Link href='/land' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='land' src='/images/home/land.png' />
                <div className={styles.linkName}>Land Points</div>
              </div>
            </Link>

            <Link href='/tissots' passHref>
              <div className={styles.linkContainer}>
                <img width={640} height={363} alt='tissots' src='/images/home/tissots.png' />
                <div className={styles.linkName}>{'Tissot\'s Indicatrix'}</div>
              </div>
            </Link>

          </div>

        </div>
      </main>
    </div>
  )
}

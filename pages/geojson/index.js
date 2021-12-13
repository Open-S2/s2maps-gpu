/* REACT MODULES */
import Map from '../../components/map'
/* JSON */
import style from './style.json'

import styles from '../../styles/geojson.module.css'

export default function GeoJSON () {
  return (
    <div>
      <Map style={style} />
      <div id={styles.legendContainer}>
        <div id={styles.legendHeader}>US Covid 2019 Confirmed Cases</div>
        <div id={styles.legendChoropleth}>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>0 - 341</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>341 - 1015</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>1015 - 2000</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>2000 - 3174</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>3174 - 5911</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>5911 - 13319</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>13319 - 28804</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>28804+</div>
          </div>
        </div>
      </div>
    </div>
  )
}

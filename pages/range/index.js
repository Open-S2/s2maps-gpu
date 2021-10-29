/* REACT MODULES */
import Map from '../map'
/* JSON */
import style from './style.json'

import styles from '../../styles/range.module.css'

export default function Range () {
  return (
    <div>
      <Map style={style} />

      <div id={styles.legendContainer}>

        <div id={styles.legendHeader}>Project Status</div>
        <div id={styles.legendChoropleth}>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>Operating</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>Under Development</div>
          </div>
          <div className={styles.choroplethContainer}>
            <div className={styles.choroplethColor} />
            <div className={styles.choroplethExplain}>Under Construction</div>
          </div>
        </div>

        <div id={styles.legendHeader}>Project Capacity</div>
        <div id={styles.circleContainer}>
          <span className={styles.circle} id={styles.circle1} />
          <span className={styles.circle} id={styles.circle2} />
          <span className={styles.circle} id={styles.circle3} />
          <span className={styles.circle} id={styles.circle4} />
          <span className={styles.circle} id={styles.circle5} />
          <span className={styles.circle} id={styles.circle6} />
        </div>
        <div id={styles.legendHeader}>1 - 100+ MW</div>

      </div>
    </div>
  )
}

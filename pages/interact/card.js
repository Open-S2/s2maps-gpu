/* eslint camelcase: "off" */
/* STYLESHEETS */
import styles from '../../styles/interact.module.css'

export default function Card (props) {
  const { display, close } = props
  if (!display) return null
  const info = props.info ? props.info : {}

  let {
    title, address_line_1, address_line_2, city, province_state, postal_code,
    address_notes, directions_link, destination_website, sales_phone, amenities,
    hours, chargers, location_type
  } = info
  postal_code = +postal_code

  const salesPhone = (Array.isArray(sales_phone) && sales_phone.length)
    ? sales_phone.map((phone, i) => {
        return (
          <div key={i} className={styles.cardPhone}>
            <div style={{ fontWeight: 'bold' }}>{phone.label}</div>
            <div><a href={'tel:' + phone.number.replace(/[^\d]/g, '')}>{phone.number}</a></div>
          </div>
        )
      })
    : null

  const store = location_type && location_type.includes('store')

  if (!props.info) {
    // SKELETON
    return (
      <div className={styles.Card}>
        <div className={styles.closeContainer} onClick={close}>
          <div className={styles.close} />
        </div>
        <div className={styles.skeletonContainer}>
          <div className={styles.header} />
        </div>
        <div className={styles.skeletonContainer}>
          <div className={`${styles.line} ${styles.line1}`} />
          <div className={`${styles.line} ${styles.line2}`} />
          <div className={`${styles.line} ${styles.line3}`} />
        </div>
      </div>
    )
  } else {
    // LOCATION DATA
    return (
      <div className={styles.Card}>
        <div className={styles.closeContainer} onClick={close}>
          <div className={styles.close} />
        </div>
        <div className={styles.cardBody}>
          {(title) ? <div className={`${styles.cardItem} ${styles.cardItemTitle}`}>{title}</div> : null}
          {address_line_1 && <div className={styles.cardItem}><div>{address_line_1}</div><div>{address_line_2}</div><div>{city}, {province_state} {postal_code}</div></div>}
          {
            (address_notes)
              ? <div className={styles.cardItem}><div>{address_notes}</div><div><a target='popup' href={directions_link}>Driving Directions</a></div></div>
              : (directions_link)
                  ? <div className={styles.cardItem}><a target='popup' href={directions_link}>Driving Directions</a></div>
                  : null
          }
          {
            (destination_website) ? <div className={styles.cardItem}><div style={{ fontWeight: 'bold' }}>Destination Website</div><a target='popup' href={destination_website} style={{ display: 'block', overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destination_website}</a></div> : null
          }

          {salesPhone && <div className={styles.cardItem}>{salesPhone}</div>}

          {(amenities) ? <div className={styles.cardItem}><div dangerouslySetInnerHTML={{ __html: amenities }} /></div> : null}
          {(hours) ? <div className={`${styles.cardItem} ${styles.cardItemNoPadding}`}><div dangerouslySetInnerHTML={{ __html: hours }} /></div> : null}
          {(chargers) ? <div className={`${styles.cardItem} ${styles.cardItemNoPadding}`}><div dangerouslySetInnerHTML={{ __html: chargers }} /></div> : null}
        </div>

        <div>
          {
            (store && postal_code)
              ? <a target='popup' href={`https://www.tesla.com/drive?zip_code=${postal_code}`} className={styles.cardFooter}>Schedule a Test Drive</a>
              : <a target='popup' href='https://www.tesla.com/findus/list' className={styles.cardFooter}>View All Tesla Locations</a>
          }
        </div>
      </div>
    )
  }
}

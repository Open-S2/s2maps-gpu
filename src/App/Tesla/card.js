import React from 'react'

function Card (props) {
  const { display, close } = props
  if (!display) return null
  let info = props.info ? props.info : {}

  let {
    title, address_line_1, address_line_2, city, province_state, postal_code,
    address_notes, directions_link, destination_website, sales_phone, amenities,
    hours, chargers, location_type
  } = info
  postal_code = +postal_code

  sales_phone = (Array.isArray(sales_phone) && sales_phone.length)
    ? <div className="card-item">
        {
          sales_phone.map((phone, i) => {
            return (
              <div key={i} className="card-phone">
                <div style={{fontWeight: 'bold'}}>{phone.label}</div>
                <div><a href={'tel:' + phone.number.replace(/[^\d]/g, '')}>{phone.number}</a></div>
              </div>
            )
          })
        }
      </div>
    : null

  const store = location_type && location_type.includes('store')

  if (!props.info) {
    // SKELETON
    return (
      <div className="Card">
        <div className="close-container" onClick={close} >
          <div className="close" />
        </div>
        <div className="skeleton-container">
          <div className="header" />
        </div>
        <div className="skeleton-container">
          <div className="line line-1" />
          <div className="line line-2" />
          <div className="line line-3" />
        </div>
      </div>
    )
  } else {
    // LOCATION DATA
    return (
      <div className="Card">
        <div className="close-container" onClick={close} >
          <div className="close" />
        </div>
        <div className="card-body">
          { (title) ? <div className="card-item card-item-title">{title}</div> : null }
          {
            (address_line_1)
              ? <div className="card-item"><div>{address_line_1}</div><div>{address_line_2}</div><div>{city}, {province_state} {postal_code}</div></div>
              : null
          }
          {
            (address_notes)
              ? <div className="card-item"><div>{address_notes}</div><div><a target="popup" href={directions_link}>Driving Directions</a></div></div>
              : (directions_link)
                ? <div className="card-item"><a target="popup" href={directions_link}>Driving Directions</a></div>
                : null
          }
          {
            (destination_website) ? <div className="card-item"><div style={{fontWeight: 'bold'}}>Destination Website</div><a target="popup" href={destination_website} style={{ display: 'block', overflowX: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{destination_website}</a></div> : null
          }

          {sales_phone}

          { (amenities) ? <div className="card-item"><div dangerouslySetInnerHTML={{ __html: amenities }} /></div> : null }
          { (hours) ? <div className="card-item card-item-no-padding"><div dangerouslySetInnerHTML={{ __html: hours }} /></div> : null }
          { (chargers) ? <div className="card-item card-item-no-padding"><div dangerouslySetInnerHTML={{ __html: chargers }} /></div> : null }
        </div>

        <div>
          {
            (store && postal_code)
              ? <a target="popup" href={`https://www.tesla.com/drive?zip_code=${postal_code}`} className="card-footer">Schedule a Test Drive</a>
              : <a target="popup" href="https://www.tesla.com/findus/list" className="card-footer">View All Tesla Locations</a>
          }
        </div>
      </div>
    )
  }
}

export default Card

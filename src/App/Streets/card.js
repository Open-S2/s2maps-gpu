import React from 'react'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function Card (props) {
  const { display, close } = props
  if (!display) return null
  const info = props.info ? props.info : {}

  const { abbr, details, name } = info
  const title = abbr || name
  const cardDetails = (details) ? <CardDetails details={details} /> : null

  if (!props.info) {
    // SKELETON
    return (
      <div className='Card'>
        <div className='close-container' onClick={close}>
          <div className='close' />
        </div>
        <div className='skeleton-container'>
          <div className='header' />
        </div>
        <div className='skeleton-container'>
          <div className='line line-1' />
          <div className='line line-2' />
          <div className='line line-3' />
        </div>
      </div>
    )
  } else {
    // LOCATION DATA
    return (
      <div className='Card'>
        <div className='close-container' onClick={close}>
          <div className='close' />
        </div>
        <div className='card-body'>
          {(title) ? <div className='card-item card-item-title'>{title}</div> : null}
          {cardDetails}
        </div>
      </div>
    )
  }
}

function CardDetails ({ details }) {
  let { extract, wikiLink, inception, externalData, motto, officialLanguage } = details

  if (wikiLink) wikiLink = <a target='popup' href={wikiLink}>Wikipedia</a>
  else wikiLink = null

  if (externalData) externalData = <a target='popup' href={externalData}>{externalData}</a>
  else externalData = null

  if (inception) inception = new Date(inception)
  else inception = null

  if (officialLanguage) officialLanguage = officialLanguage[0]
  else officialLanguage = null

  return (
    <div className='card-details'>
      <div className='card-item'>
        {
          (extract)
            ? <div><div dangerouslySetInnerHTML={{ __html: extract }} />{wikiLink}</div>
            : null
        }
      </div>

      {
        (inception)
          ? <div className='card-item card-item-flex'><div className='card-item-key'>Inception: </div><div className='card-item-value'>{MONTH_NAMES[inception.getMonth()]} {Math.max(inception.getDay(), 1)}, {inception.getFullYear()}</div></div>
          : null
      }

      {
        (motto)
          ? <div className='card-item card-item-flex'><div className='card-item-key'>Motto: </div><div className='card-item-value'>{motto}</div></div>
          : null
      }

      {
        (officialLanguage)
          ? <div className='card-item card-item-flex'><div className='card-item-key'>officialLanguage: </div><div className='card-item-value'>{officialLanguage}</div></div>
          : null
      }

      {
        (externalData)
          ? <div className='card-item card-item-flex'><div className='card-item-key'>Website: </div><div className='card-item-value'>{externalData}</div></div>
          : null
      }
    </div>
  )
}

export default Card

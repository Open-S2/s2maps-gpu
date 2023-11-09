import React from 'react'
import '../styles/globals.css'
import '../styles/s2maps.css'

import type { AppProps } from 'next/app'
// import type { NextComponentType, NextPageContext } from 'next'

function MyApp ({ Component, pageProps }: AppProps): React.JSX.Element {
  return <Component {...pageProps} />
}

export default MyApp

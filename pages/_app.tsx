import '../styles/globals.css'
import '../styles/s2maps.css'

import type { AppProps } from 'next/app'
// import type { NextComponentType, NextPageContext } from 'next'

// TODO: Proper return type
function MyApp ({ Component, pageProps }: AppProps): any {
  return <Component {...pageProps} />
}

export default MyApp

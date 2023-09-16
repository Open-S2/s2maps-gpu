/** @type {import('next').NextConfig} */
module.exports = {
  // NOTE: Do not use CORS for online testing. Maybe remove this later.
  env: {
    CORS: '0'
  },
  swcMinify: false,
  reactStrictMode: false,
  images: {
    formats: ['image/avif', 'image/webp']
  },
  typescript: {
    tsconfigPath: './tsconfig.next.json'
  },
  webpack: (config, options) => {
    config.externals.push('bun:sqlite')
    // glsl
    config.module.rules.push({
      test: /\.glsl$/,
      use: [
        options.defaultLoaders.babel,
        {
          loader: require.resolve('./config/glsl-loader')
        }
      ]
    })
    // wgsl
    config.module.rules.push({
      test: /\.wgsl$/i,
      use: 'raw-loader'
    })
    // svg
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })
    // wasm
    config.module.rules.push({
      test: /\.wasm$/,
      type: 'javascript/auto',
      use: ['arraybuffer-loader']
    })

    return config
  }
}

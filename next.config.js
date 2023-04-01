/** @type {import('next').NextConfig} */
module.exports = {
  swcMinify: false,
  reactStrictMode: false,
  images: {
    formats: ['image/avif', 'image/webp']
  },
  typescript: {
    tsconfigPath: './tsconfig.json'
  },
  webpack: (config, options) => {
    config.module.rules.push({
      test: /\.glsl$/,
      use: [
        options.defaultLoaders.babel,
        {
          loader: require.resolve('./config/glsl-loader')
        }
      ]
    })

    config.module.rules.push({
      test: /\.wgsl$/i,
      use: 'raw-loader'
    })

    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack']
    })

    return config
  }
}

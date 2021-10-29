module.exports = {
  swcMinify: true,
  reactStrictMode: true,
  images: {
    formats: ['image/avif', 'image/webp']
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

    return config
  }
}

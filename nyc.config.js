export default {
  extends: '@istanbuljs/nyc-config-typescript',
  'temp-dir': './.nyc_output',
  'report-dir': './coverage',
  include: ['s2'],
  exclude: ['**/gis-tools/**'],
  all: true,
  reporter: ['html-spa', 'lcovonly', 'cobertura', 'text-summary'],
};

export default {
  extends: '@istanbuljs/nyc-config-typescript',
  'temp-dir': './.nyc_output',
  'report-dir': './coverage',
  include: ['s2/**/*.ts', 's2/*.ts'],
  exclude: ['**/*.test.ts'],
  all: true,
  reporter: ['html-spa', 'lcovonly', 'cobertura', 'text-summary'],
};

// {
//   "all": true,
//   "extends": "@istanbuljs/nyc-config-typescript",
//   "reporter": ["html", "lcov"],
//   "include": ["s2/**/*.ts", "s2/*.ts"],
//   "exclude": ["**/*.test.ts"],
//   "report-dir": "./coverage",
//   "temp-dir": "./.nyc_output"
// }

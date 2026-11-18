const base = require('../../jest.config.base.js');
const pkg = require('./package');

module.exports = {
  ...base,
  displayName: pkg.name,
  // Our tests are .test.{js,jsx,ts,tsx}; upstream's base config matches .js and .ts only.
  testMatch: ['<rootDir>/src/**/*.test.{js,jsx,ts,tsx}'],
};

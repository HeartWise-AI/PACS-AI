const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const env = dotenv.config({ path: path.resolve(__dirname, '../.env') }).parsed;

// Create content for env-config.js
const envConfigContent = `window._env_ = {
  ORTHANC_API_URL: "${env.ORTHANC_API_URL}"
};`;

// Write the content to env-config.js
fs.writeFileSync(
  path.resolve(__dirname, '../public/env-config.js'),
  envConfigContent
);

console.log('env-config.js has been generated successfully.');

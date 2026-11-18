const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from .env file
const env = dotenv.config({ path: path.resolve(__dirname, '../../platform/app/.env') }).parsed;

// Create content for env-config.js
const envConfigContent = `window._env_ = {
  APP_PUBLIC_API_URL: "${env.APP_PUBLIC_API_URL}"
};`;

// Write env-config.js where pacs-ai/build/extend.js copies it into the build
// (git-ignored: pacs-ai/build/.gitignore).
const outDir = path.resolve(__dirname, 'generated');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'env-config.js'), envConfigContent);

console.log('env-config.js has been generated successfully.');

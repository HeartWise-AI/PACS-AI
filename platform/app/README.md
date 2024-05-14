## PACS AI OHIF Viewer

Based on https://github.com/OHIF/Viewers (v3.7.0)

### Setup

_Requirements:_

- https://github.com/nvm-sh/nvm (recommended so you can switch Node versions effortlessly)
- `nvm install 18.13.0`
- `nvm use 18.13.0`
- To check version, `node --version`

### Developing Locally

> Before running this repository, you need to run the PACS AI backend first.
>
> You can easily do so by following https://github.com/HeartWise-AI/pacs-ai-backend/blob/master/api-pacs/README.md

In your cloned repository's root folder, run:

```js
// necessary yarn step
yarn config set workspaces-experimental true

// Restore dependencies
yarn install

// Provide platform/app/.env
// Get the env values from Robert Avram
cp ./platform/app/.env.example ./platform/app/env

// For Orthanc study list, modify the APP_CONFIG with the following values:
APP_CONFIG=config/default.js // default connection to OHIF viewer test data
APP_CONFIG=config/local_pacs_ai.js // connect to local orthanc (you need to run pacs-ai-backend first)
APP_CONFIG=config/staging_pacs_ai.js // connect to staging orthanc

// Stands up local server to host Viewer.
// Viewer connects to our public cloud PACS by default
yarn start

// for staging data, visit the following tenant
http://localhost:3000/login?t=qhn-mha-nzjew

```

Maintainers: Karl from Nuxify, Dan from Nuxify

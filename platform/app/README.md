# PACS AI OHIF Viewer

[![Based on OHIF Viewers v3.9.0](https://img.shields.io/badge/OHIF-v3.9.0-blue)](https://github.com/OHIF/Viewers)

A powerful medical imaging viewer built on top of the OHIF platform, integrated with PACS AI capabilities.

## Prerequisites

Before running this repository, you need to have the PACS AI backend up and running. Follow the setup instructions in the [PACS AI Backend Repository](https://github.com/HeartWise-AI/pacs-ai-backend/blob/master/api-pacs/README.md).

## Environment Setup

### Requirements

- [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) - Recommended for easy Node.js version management
- Node.js 18.17.0
- Yarn package manager

### Environment Variables

1. Create your environment file:
   ```bash
   cp ./platform/app/.env.example ./platform/app/.env
   ```

2. Configure the following variables in your `.env` file:

   | Variable | Description |
   |----------|-------------|
   | `APP_PUBLIC_API_URL` | PACS AI backend URL (local: `http://localhost/api`, prod: `https://hostname/api`) |
   | `APP_PUBLIC_DEFAULT_TENANT` | Tenant ID from Google Cloud Platform |
   | `APP_FIREBASE_API_KEY` | Firebase project API key |
   | `APP_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain |
   | `APP_FIREBASE_PROJECT_ID` | Firebase project ID |
   | `APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
   | `APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
   | `APP_FIREBASE_APP_ID` | Firebase application ID |
   | `APP_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID |

   Default configurations (no changes needed):
   ```
   PUBLIC_URL=/
   APP_CONFIG=config/local_pacs_ai.js
   USE_HASH_ROUTER=false
   ```

## Production Setup

No changes needed anymore! You only needed to setup the environment variables in your environment file. Pick up where you left off in the [PACS AI Backend Repository](https://github.com/HeartWise-AI/pacs-ai-backend/blob/master/api-pacs/README.md).


## Local Development Setup

1. **Set up Node.js environment**
   ```bash
   nvm install 18.13.0
   nvm use 18.13.0
   ```
   Verify installation: `node --version`

2. **Install dependencies**
   ```bash
   # Install Yarn globally
   npm install -g yarn

   # Configure Yarn workspaces
   yarn config set workspaces-experimental true

   # Install project dependencies
   yarn install
   ```

3. **Start the development server**
   ```bash
   yarn start
   ```

4. **Access the viewer**

   Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Support

Maintained with ❤️ by [Nuxify](https://nuxify.tech) & [HeartWise](https://heartwise.ai)

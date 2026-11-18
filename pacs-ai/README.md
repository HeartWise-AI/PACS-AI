# PACS AI OHIF Viewer

[![Based on OHIF Viewers v3.13.14](https://img.shields.io/badge/OHIF-v3.13.14-blue)](https://github.com/OHIF/Viewers)

A powerful medical imaging viewer built on top of the OHIF platform, integrated with PACS AI capabilities.

## Prerequisites

Before running this repository, you need to have the PACS AI backend up and running. Follow the setup instructions in the [PACS AI Backend Repository](https://github.com/HeartWise-AI/pacs-ai-backend/blob/master/api-pacs/README.md).

## Environment Setup

### Requirements

- [nvm (Node Version Manager)](https://github.com/nvm-sh/nvm) - Recommended for easy Node.js version management
- Node.js 24.22.2 (`.node-version`)
- pnpm 12.8.1 (`packageManager` in `package.json`)

### Environment Variables

1. Create your environment file:
   ```bash
   cp ./pacs-ai/build/env.example ./platform/app/.env
   ```

2. Configure the following variables in your `.env` file:

   | Variable | Description |
   |----------|-------------|
   | `APP_PUBLIC_API_URL` | PACS AI backend URL (local: `http://localhost/api`, prod: `https://hostname/api`) |
   | `APP_PUBLIC_DEFAULT_TENANT` | Tenant ID from Google Cloud Platform |
   | `APP_PUBLIC_TURNSTILE_SITE_KEY` | Public Cloudflare Turnstile site key used by registration and server-requested login challenges; never place the secret key in the frontend |
   | `APP_PUBLIC_TERMS_OF_USE_URL` | Current Terms of Use document URL shown during public registration |
   | `APP_PUBLIC_PRIVACY_POLICY_URL` | Current Privacy Policy document URL shown during public registration |
   | `APP_PUBLIC_STUDY_PROCESSING_SSE_ENABLED` | Enables authenticated live worklist updates; set to `false` to roll back to REST snapshots |
   | `APP_PUBLIC_CANDIDATE_PROCESSING_POLL_ENABLED` | Keeps legacy candidate transition polling independently available during SSE rollout |
   | `APP_FIREBASE_API_KEY` | Firebase project API key |
   | `APP_FIREBASE_AUTH_DOMAIN` | Firebase authentication domain |
   | `APP_FIREBASE_PROJECT_ID` | Firebase project ID |
   | `APP_FIREBASE_STORAGE_BUCKET` | Firebase storage bucket |
   | `APP_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID |
   | `APP_FIREBASE_APP_ID` | Firebase application ID |
   | `APP_FIREBASE_MEASUREMENT_ID` | Firebase measurement ID |

   The registration policy links are informational configuration only. Versioned policy identifiers,
   required acceptance, persistence, and post-login enforcement remain blocked by
   `HeartWise-AI/pacs-ai-backend#282`; do not treat the presence of these links as recorded acceptance.

   Login bot protection is adaptive: ordinary login does not render Turnstile. When the backend
   requires additional verification, the frontend renders the same public widget with the dedicated
   `login` action and sends its single-use token only to the backend login endpoint. The Turnstile
   secret and verification policy remain backend-only. Login credentials are sent directly to the
   PACS AI backend over the configured API connection; browser-side Firebase password authentication
   is not part of this login flow. Except for local development, `APP_PUBLIC_API_URL` must use HTTPS
   so credentials are encrypted in transit.

   Default configurations (no changes needed):
   ```
   PUBLIC_URL=/
   APP_CONFIG=config/pacs-ai.js
   USE_HASH_ROUTER=false
   ```

## Production Setup

No changes needed anymore! You only needed to setup the environment variables in your environment file. Pick up where you left off in the [PACS AI Backend Repository](https://github.com/HeartWise-AI/pacs-ai-backend/blob/master/api-pacs/README.md).


## Local Development Setup

1. **Set up Node.js environment** (Node 24, as `.node-version`)
   ```bash
   nvm install 24.22.2
   nvm use 24.22.2
   ```
   Verify installation: `node --version`

2. **Install dependencies** (pnpm 12, as `packageManager` in `package.json`)
   ```bash
   npm install -g pnpm@12.8.1
   pnpm install --frozen-lockfile
   ```

3. **Start the development server**
   ```bash
   APP_CONFIG=config/pacs-ai.js pnpm run dev
   ```

4. **Access the viewer**

   Open your browser and navigate to [http://localhost:3000](http://localhost:3000)

## Upstream base and local changes

The viewer is OHIF v3.13.14 (`pacs-ai/UPSTREAM_REF`) with the PACS-AI code in
its own packages: `extensions/pacs-ai-{core,ui,theme,shell,inference,chat}`,
`modes/pacs-ai`, and `pacs-ai/` (app config, build hook, Docker, scripts,
docs). Upstream files are left as they are, except for the rows of the patch
ledger. `pacs-ai/scripts/check-upstream-drift.sh --enforce --forbid-ohif-ui`
checks this in CI (`pacs-ai-drift.yml`).

Numbers on `integration/ohif-3.13` (P3.6, 2026-11-18, against
`refs/upstream/v3.13.14`):

| Measure | Value |
|---|---:|
| Modified upstream files | 15 (7 ledger + 8 expected) |
| Ledger rows (limit 15) | 7 |
| Unexplained files | 0 |
| Theme-debt files | 0 |
| Import-direction violations | 0 |

Ledger rows (`pacs-ai/UPSTREAM_PATCHES.md`, patches in `pacs-ai/patches/`):

| # | Upstream file | Why |
|---|---|---|
| 0001 | `.webpack/webpack.base.js` | build hook: build ID, Turnstile key, processing flags as defines |
| 0002 | `platform/app/.webpack/webpack.pwa.js` | build hook: `version.json`, no service-worker manifest, our app config and env defaults |
| 0003 | `rsbuild.config.ts` | the same hook for `dev:fast` |
| 0004 | `extensions/default/src/DicomWebDataSource/utils/StaticWadoClient.ts` | bulk data URIs through the authenticated API proxy (retire at 3.14) |
| 0005 | `.prettierignore` | Prettier formats our paths only |
| 0006 | `platform/app/.env` | the deployment's build environment stays untracked |
| 0007 | `platform/app/.gitignore` | keeps that file untracked |

Expected files (generated or merged by design): root and app `package.json`,
`pnpm-lock.yaml`, `pnpm-workspace.yaml`, `platform/app/pluginConfig.json`
(`@pacs-ai/mode-viewer` instead of `@ohif/mode-longitudinal`), and three
workflow files (`playwright.yml` disabled, `codespell.yml.disabled`).

How the migration was done and its results: `docs/ohif-upgrade/PLAN.md` and
`docs/ohif-upgrade/STATUS.md`.

## Support

Maintained with ❤️ by [Nuxify](https://nuxify.tech) & [HeartWise](https://heartwise.ai)

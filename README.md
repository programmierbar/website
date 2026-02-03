# programmier.bar website

Source code of: [https://www.programmier.bar/](https://www.programmier.bar/)

## Structure

- /nuxt-app: Nuxt.js frontend application (website)
- /directus-cms: Directus headless CMS extensions
- /shared-code: Shared code between the two

## Setup

These install instructions assume you are using Node.js version 19+ (CI uses v22, tested up to v24).

**Prerequisites for Node 22+:**
- Python 3 with setuptools (for native module compilation)
- On macOS: `brew install python-setuptools`

### Nuxt-App (Website)

_All commands should be run from within `./nuxt-app/`_

- To install the dependencies run `npm install`, this will also trigger the `postinstall` hook and run `nuxt prepare` for you.
- Spin up a hot-reloading development server by running `npm run dev` and open the URL shown in your console output.

### Directus

By default, the nuxt-app will query our production instance of directus to fetch podcast data and website content.
That is fine for all development purposes where you only need to work on the nuxt-app.

If you need a development instance of directus however, please follow the below steps:

_All commands should be run from within `./directus-cms/`_

**Quick setup (recommended):**

```bash
cd directus-cms
npm run setup
```

This single command will:
- Create `.env` from `.env.example`
- Install all dependencies
- Build the extensions
- Bootstrap and apply the schema
- Import sample data from the production site

**Setup options:**

```bash
npm run setup           # Full setup with sample data from production
npm run setup:no-data   # Setup without importing production data
npm run setup:reset     # Delete existing DB and start fresh
```

**After setup:**

Start the server with `npm run start` and access:
- Admin panel: http://localhost:8055
- Login: `admin@programmier.bar` / `123456`

To use the local Directus with Nuxt, create `nuxt-app/.env` with:
```
DIRECTUS_CMS_URL=http://localhost:8055
```

**Manual setup (alternative):**

If you prefer to run each step manually:
1. Copy `.env.example` to `.env`
2. Install dependencies: `npm install`
3. Build the extensions: `cd extensions/directus-extension-programmierbar-bundle && npm install && npm run build && cd ../..`
4. Bootstrap Directus: `npm run bootstrap`
5. Apply the schema: `npm run apply-schema` (confirm with 'y')
6. Set up local dev environment: `npm run setup-local` or `npm run setup-local:with-data`
7. Start the server: `npm run start`

#### Extensions

All extensions that are plain JavaScript and **do not** require a build process are located in `directus-cms/extensions`.
They will automatically be loaded at runtime.

Extensions that **do** require a build process are located in `directus-cms/extensions/directus-extension-programmierbar-bundle`.
Build with: `npm install && npm run build`

## Feedback

We welcome any form of [feedback](https://www.programmier.bar/kontakt)! If you are interested, you can also create a pull request directly.

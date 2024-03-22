# programmier.bar website

Source code of: [https://www.programmier.bar/](https://www.programmier.bar/)

## Structure

- /nuxt-app: Nuxt.js frontend application (website)
- /directus-cms: Directus headless CMS extensions
- /shared-code: Shared code between the two

## Setup

These install instructions assume you are using node version ^19.0.0 and have `yarn` installed.
If not please, run `npm install -g yarn` before following these instructions. 

### Nuxt-App (Website)

_All commands should be run from within `./nuxt-app/`_

- To install the dependencies run `yarn install`, this will also trigger the `postinstall` hook and run `nuxt prepare` for you.
- Spin up a hot-reloading development server by running `yarn run dev` and open the URL shown in your console output.

### Directus

By default, the nuxt-app will query our production instance of directus to fetch podcast data and website content.
That is fine for all development purposes where you only need to work on the nuxt-app.

If you need a development instance of directus however, please follow the below steps:

_All commands should be run from within `./directus-cms/`_

- To install the dependencies run `yarn install`.
- Then bootstrap directus using `yarn run bootstrap`. 
- To build the code required for the extensions run `yarn run build`.
- Spin up a development server by running `yarn run start` and open the URL shown in your console output.

You can find the default login credentials in the `.env` file.

If you need pre-defined data structures available, you can run `yarn run apply-schema` 
Please be aware that - for now - the included schema is not guaranteed to be in sync with the production schema.
For instructions on how to obtain a recent schema.json file, please see `directus-cms/_requests/Directus.http`.

#### Extensions

All extensions that are plain JavaScript and **do not** require a build process are located in `directus-cms/extensions`.
They will automatically be loaded at runtime.

Extension that **do** require a build process are located in `directus-cms/extensions-src`.
Here, every extension is its own independent subproject that needs to be build and symlinked.

While each extension can technically be different, you can refer to our docker build process
to see how they are being build: [Dockerfile.directus](./Dockerfile.directus)

##### Publishable Interface Extension

Navigate to `directus-cms/extensions-src/publishable` and run the following commands:

* `npm install`
* `npm run build`
* `npm run link ../../extensions`

## Feedback 😍 ♥️ 

We welcome any form of [feedback](https://www.programmier.bar/kontakt)! If you are interested, you can also create a pull request directly.

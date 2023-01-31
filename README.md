# programmier.bar website

Source code of: [https://www.programmier.bar/](https://www.programmier.bar/)

## Structure

- /cloud-functions: Firebase Cloud Functions backend
- /directus-cms: Directus headless CMS configuration
- /nuxt-app: Nuxt.js frontend application (website)
- /shared-code: Shared code between the applications

## Setup

Start by installing all dependencies from the root project

`yarn install`

### Shared Code
The shared-code repository must be initially build, in order for other workspaces to be used. Therefore run 

`yarn workspace shared-code build`

### Directus
For a local setup of the directus-cms run the following:

`yarn workspace directus-cms bootstrap`
`yarn workspace directus-cms apply-schema`

## Feedback 😍 ♥️ 

We welcome any form of [feedback](https://www.programmier.bar/kontakt)! If you are interested, you can also create a pull request directly.

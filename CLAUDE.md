# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Architecture

This is a monorepo for the programmier.bar website with three main components:

- `/nuxt-app`: Nuxt.js 3 frontend application (main website)
- `/directus-cms`: Directus v11 headless CMS with custom extensions  
- `/shared-code`: Shared TypeScript code between frontend and CMS

The frontend queries Directus CMS for podcast data, meetup information, speakers, and website content. By default, the nuxt-app connects to the production Directus instance.

## Development Commands

### Nuxt App (Frontend)
Run all commands from `./nuxt-app/`:

- `yarn install` - Install dependencies and run postinstall hook
- `yarn run dev` - Start hot-reloading development server
- `yarn run build` - Build for production
- `yarn run generate` - Generate static site
- `yarn run preview` - Preview production build
- `yarn run eslint` - Run ESLint with auto-fix
- `yarn run prettier` - Format code with Prettier

### Directus CMS  
Run all commands from `./directus-cms/`:

- `yarn install` - Install dependencies
- `yarn run bootstrap` - Bootstrap Directus (includes migration)
- `yarn run start` - Start development server
- `yarn run migrate:db` - Run database migrations
- `yarn run snapshot-schema` - Export current schema to schema.json
- `yarn run apply-schema` - Apply schema.json to database

For Directus extensions requiring build process (in `directus-cms/extensions-src/`), each extension needs:
- `npm install`
- `npm run build` 
- `npm run link ../../extensions`

## Key Technical Details

### Frontend Stack
- Nuxt 3 with SSR enabled
- Vue 3 with TypeScript
- Tailwind CSS for styling
- Pinia for state management
- Directus SDK for CMS integration
- Algolia for search functionality

### Configuration
- Environment config in `nuxt-app/config.ts`
- Feature flags system for toggling functionality
- Runtime config for sensitive values like email passwords
- Prerendering configured for dynamic routes (podcasts, meetups, speakers)

### Project Structure
- `pages/` - File-based routing with dynamic routes for podcasts, meetups, speakers
- `components/` - Vue components, many prefixed by content type (Podcast*, Meetup*, Conference*)
- `composables/` - Vue 3 composition functions for reusable logic
- `server/api/` - Nitro API routes (currently just email endpoint)
- `server/middleware/` - Server middleware for redirects and special routes

### Content Management
- All content managed through Directus CMS
- Dynamic route generation at build time via nitro:config hook
- Images served through Nuxt Image with Directus asset integration
- Contact form with spam protection (honeypot validation on server-side)

### Development Notes
- Node.js ^19.0.0 required with yarn package manager
- Uses shared-code alias for importing common utilities between apps
- SVG files loaded as Vue components via vite-svg-loader
- Email functionality via nodemailer with server-side validation using Zod schemas
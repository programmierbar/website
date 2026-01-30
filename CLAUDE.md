# CLAUDE.md - Project Guide for AI Assistants

This file provides context for AI assistants working with the programmier.bar website codebase.

## Project Overview

A podcast/conference/meetup platform for the German developer community. Built with Nuxt 3 (Vue 3) frontend and Directus 11 headless CMS.

## Tech Stack

- **Frontend**: Nuxt 3, Vue 3, TypeScript, Tailwind CSS, Pinia
- **CMS**: Directus 11 (headless CMS)
- **Server**: Nitro (Nuxt's server engine)
- **Search**: Algolia
- **AI**: Google Gemini (spam filtering)
- **Node**: v19+ (v22 in CI)

## Directory Structure

```
website/
├── nuxt-app/           # Main Nuxt 3 frontend
│   ├── components/     # 77 Vue components
│   ├── composables/    # 24 Vue composables
│   ├── helpers/        # Utility functions
│   ├── types/          # TypeScript definitions
│   ├── pages/          # File-based routing
│   ├── server/         # Nitro API routes
│   └── config.ts       # Feature flags & constants
├── directus-cms/       # Directus CMS instance
│   └── extensions/     # Custom Directus extensions
└── shared-code/        # Shared TypeScript code
```

## Common Commands

### Nuxt App (run from `nuxt-app/`)

```bash
yarn run dev          # Development server
yarn run build        # Production build
yarn run generate     # Static site generation
yarn run eslint       # Lint with auto-fix
yarn run prettier     # Format code
```

### Directus CMS (run from `directus-cms/`)

```bash
yarn run start        # Start Directus server
yarn run build        # Build extensions
yarn run migrate:db   # Database migrations
```

### Testing

```bash
# In directus-cms/extensions/directus-extension-programmierbar-bundle/
npm test              # Run Jest tests
```

## Code Style

- **Prettier**: 120 char width, 4 spaces, no semicolons, trailing commas
- **ESLint**: Nuxt recommended config with TypeScript
- **Imports**: Auto-sorted, use `type` keyword for type-only imports
- **Components**: PascalCase, single-word names allowed

## Key Patterns

### Type System

Directus types follow a preparation pattern:
- `DirectusPodcastItem` - Raw CMS type with ID references
- `PodcastItem` - Prepared type with hydrated relationships

### Composables

Main composables in `nuxt-app/composables/`:
- `useDirectus()` - CMS data fetching (most important, 884 lines)
- `usePodcastPlayer()` - Podcast playback state
- `useProfileCreationStore()` - User profile state

### Configuration

Feature flags and constants in `nuxt-app/config.ts`:
- `FLAG_SHOW_LOGIN` - Toggle login UI
- `DEVTOOLS` - Enable Nuxt DevTools
- Event tracking IDs (80+ constants)

### Server API

Email endpoint at `/api/email` (POST):
- Zod schema validation
- Gemini AI spam filtering
- Honeypot protection

## Environment Variables

Key variables (see `.env.example` if exists):
- `DIRECTUS_CMS_URL` - Directus instance URL
- `WEBSITE_URL` - Public website URL
- `NUXT_ENV` - 'development' or 'production'
- `ALGOLIA_INDEX` - Search index name

## Content Types

Main Directus collections:
- Podcasts (deep_dive, cto_special, news, other)
- Meetups & Conferences
- Speakers (Hall of Fame)
- Pick of the Day

## Important Files

- `nuxt-app/nuxt.config.ts` - Nuxt configuration
- `nuxt-app/config.ts` - App constants & feature flags
- `nuxt-app/composables/useDirectus.ts` - CMS integration
- `nuxt-app/tailwind.config.js` - Tailwind customizations
- `nuxt-app/types/directus.ts` - CMS type definitions

## Tailwind Theme

Custom colors: black, white, blue, lime, pink, gray
Breakpoints: xs(520), sm(640), md(768), lg(1024), xl(1280), 2xl(1536), 3xl(2000)
